// Finance data ingest. Polygon.io is the primary source; Finnhub is a fallback.
// Both are optional — when no key is configured, ingest gracefully no-ops and
// the user can still operate finance projects in pure-narrative mode.

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { catalystEvents, watchlistItems, type InsertCatalystEvent, type WatchlistItem } from "../drizzle/schema";
import { ENV } from "./_core/env";

interface PolygonNewsResult {
  results?: Array<{
    id: string;
    title: string;
    description?: string;
    article_url?: string;
    published_utc?: string;
    publisher?: { name?: string };
    insights?: Array<{ ticker?: string; sentiment?: string; sentiment_reasoning?: string }>;
  }>;
}

interface FinnhubNewsItem {
  id?: number | string;
  headline?: string;
  summary?: string;
  url?: string;
  datetime?: number;            // unix seconds
  source?: string;
  related?: string;
}

function classifySentiment(raw?: string | null): "bullish" | "bearish" | "neutral" | "mixed" | null {
  if (!raw) return null;
  const r = raw.toLowerCase();
  if (r.includes("positive") || r.includes("bullish")) return "bullish";
  if (r.includes("negative") || r.includes("bearish")) return "bearish";
  if (r.includes("mixed")) return "mixed";
  if (r.includes("neutral")) return "neutral";
  return null;
}

function importanceFromText(headline: string, summary?: string): number {
  const text = `${headline} ${summary ?? ""}`.toLowerCase();
  let score = 35;
  // Strong catalyst keywords push importance up.
  if (/(beats?|misses?|guidance|raised|cut|downgrad|upgrad|acquisition|merger|m&a|fda approv|recall|sec investigat|lawsuit|breach|hack|earnings|guides?|q[1-4] revenue)/i.test(text)) score += 30;
  if (/(record|surge|plunge|crash|halt|suspended|delisted|chapter 11|bankrupt)/i.test(text)) score += 25;
  if (/(rumou?r|consider|exploring|talks)/i.test(text)) score += 10;
  return Math.min(100, score);
}

// ─── Polygon.io news ──────────────────────────────────────────────────────────
async function fetchPolygonNews(symbol: string, limit = 20): Promise<InsertCatalystEvent[]> {
  if (!ENV.polygonApiKey) return [];
  const url = `https://api.polygon.io/v2/reference/news?ticker=${encodeURIComponent(symbol)}&limit=${limit}&order=desc&sort=published_utc&apiKey=${ENV.polygonApiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`[finance-ingest] polygon ${symbol}: ${res.status} ${await res.text()}`);
    return [];
  }
  const data = (await res.json()) as PolygonNewsResult;
  return (data.results ?? []).map((n) => {
    const sentimentInsight = n.insights?.find((i) => i.ticker === symbol)?.sentiment;
    return {
      projectId: 0, // filled by caller
      symbol,
      source: "polygon-news",
      externalId: n.id,
      headline: n.title,
      summary: n.description ?? null,
      url: n.article_url ?? null,
      sentiment: classifySentiment(sentimentInsight),
      importance: importanceFromText(n.title, n.description),
      publishedAt: n.published_utc ? new Date(n.published_utc) : null,
    } satisfies InsertCatalystEvent;
  });
}

// ─── Finnhub fallback ─────────────────────────────────────────────────────────
async function fetchFinnhubNews(symbol: string): Promise<InsertCatalystEvent[]> {
  if (!ENV.finnhubApiKey) return [];
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 86400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(weekAgo)}&to=${fmt(today)}&token=${ENV.finnhubApiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`[finance-ingest] finnhub ${symbol}: ${res.status}`);
    return [];
  }
  const data = (await res.json()) as FinnhubNewsItem[];
  return (Array.isArray(data) ? data : []).map((n) => ({
    projectId: 0,
    symbol,
    source: "finnhub-news",
    externalId: n.id ? String(n.id) : null,
    headline: n.headline ?? "(no headline)",
    summary: n.summary ?? null,
    url: n.url ?? null,
    sentiment: null,
    importance: importanceFromText(n.headline ?? "", n.summary),
    publishedAt: n.datetime ? new Date(n.datetime * 1000) : null,
  } satisfies InsertCatalystEvent));
}

export interface IngestResult {
  symbol: string;
  fetched: number;
  inserted: number;
  topImportance: number;
  highImpactEvents: InsertCatalystEvent[];   // for catalyst-trigger logic
  source: string;
}

export async function ingestSymbolNews(args: { projectId: number; watchlistItemId?: number; symbol: string }): Promise<IngestResult> {
  const db = await getDb();
  const polygonItems = await fetchPolygonNews(args.symbol);
  const items = polygonItems.length > 0 ? polygonItems : await fetchFinnhubNews(args.symbol);
  const source = polygonItems.length > 0 ? "polygon-news" : (items[0]?.source ?? "none");
  if (!db || items.length === 0) {
    return { symbol: args.symbol, fetched: items.length, inserted: 0, topImportance: 0, highImpactEvents: [], source };
  }

  // Dedup against existing externalIds for this project + source
  const existing = await db
    .select()
    .from(catalystEvents)
    .where(and(eq(catalystEvents.projectId, args.projectId), eq(catalystEvents.source, source)));
  const existingExternalIds = new Set(existing.map((e) => e.externalId).filter(Boolean));

  const fresh = items.filter((i) => !i.externalId || !existingExternalIds.has(i.externalId));
  let inserted = 0;
  let topImportance = 0;
  const highImpact: InsertCatalystEvent[] = [];
  for (const item of fresh) {
    const row: InsertCatalystEvent = {
      ...item,
      projectId: args.projectId,
      watchlistItemId: args.watchlistItemId ?? null,
    };
    await db.insert(catalystEvents).values(row);
    inserted += 1;
    if ((item.importance ?? 0) > topImportance) topImportance = item.importance ?? 0;
    if ((item.importance ?? 0) >= 70) highImpact.push(row);
  }
  return { symbol: args.symbol, fetched: items.length, inserted, topImportance, highImpactEvents: highImpact, source };
}

export async function ingestWatchlist(projectId: number): Promise<IngestResult[]> {
  const db = await getDb();
  if (!db) return [];
  const items: WatchlistItem[] = await db.select().from(watchlistItems).where(and(eq(watchlistItems.projectId, projectId), eq(watchlistItems.active, true)));
  const out: IngestResult[] = [];
  for (const it of items) {
    try {
      const r = await ingestSymbolNews({ projectId, watchlistItemId: it.id, symbol: it.symbol });
      out.push(r);
    } catch (err) {
      console.warn(`[finance-ingest] symbol ${it.symbol} failed:`, err);
    }
  }
  return out;
}

export async function recentCatalysts(projectId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(catalystEvents).where(eq(catalystEvents.projectId, projectId)).orderBy(desc(catalystEvents.publishedAt), desc(catalystEvents.createdAt)).limit(limit);
}

export function isFinanceConfigured(): boolean {
  return !!(ENV.polygonApiKey || ENV.finnhubApiKey);
}
