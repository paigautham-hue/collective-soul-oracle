// Tool-use available to agents during simulation. Lightweight, deterministic,
// and safe — no arbitrary code execution. Each tool is called explicitly by
// the runner when an agent's decision requests it.

import { ENV } from "./_core/env";

export type ToolName = "calc" | "current_date" | "lookup_ticker" | "web_search" | "convert_unit" | "lookup_polymarket" | "pull_recent_posts";

export interface ToolCall {
  tool: ToolName;
  args: Record<string, unknown>;
}

export interface ToolResult {
  tool: ToolName;
  ok: boolean;
  output: string;
}

const SAFE_CALC_RE = /^[\s\d+\-*/().,e%]+$/i;

function execCalc(expr: string): ToolResult {
  if (typeof expr !== "string" || expr.length > 200 || !SAFE_CALC_RE.test(expr)) {
    return { tool: "calc", ok: false, output: "calc: rejected — only digits, + - * / ( ) . , e % allowed" };
  }
  try {
    // eslint-disable-next-line no-new-func
    const value = Function(`"use strict"; return (${expr.replace(/%/g, "/100")})`)();
    return { tool: "calc", ok: true, output: String(value) };
  } catch {
    return { tool: "calc", ok: false, output: "calc: failed to evaluate" };
  }
}

function execCurrentDate(): ToolResult {
  return { tool: "current_date", ok: true, output: new Date().toISOString() };
}

async function execLookupTicker(symbol: string): Promise<ToolResult> {
  if (!symbol || typeof symbol !== "string" || symbol.length > 16) {
    return { tool: "lookup_ticker", ok: false, output: "lookup_ticker: invalid symbol" };
  }
  if (!ENV.polygonApiKey && !ENV.finnhubApiKey) {
    return { tool: "lookup_ticker", ok: false, output: "lookup_ticker: no provider configured (POLYGON_API_KEY or FINNHUB_API_KEY)" };
  }
  try {
    if (ENV.polygonApiKey) {
      const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/prev?adjusted=true&apiKey=${ENV.polygonApiKey}`;
      const res = await fetch(url);
      if (!res.ok) return { tool: "lookup_ticker", ok: false, output: `polygon ${res.status}` };
      const j = (await res.json()) as { results?: Array<{ c?: number; o?: number; h?: number; l?: number; v?: number; t?: number }> };
      const r = j.results?.[0];
      if (!r) return { tool: "lookup_ticker", ok: false, output: `no data for ${symbol}` };
      return { tool: "lookup_ticker", ok: true, output: `${symbol}: prev close=${r.c} open=${r.o} high=${r.h} low=${r.l} volume=${r.v}` };
    }
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${ENV.finnhubApiKey}`;
    const res = await fetch(url);
    if (!res.ok) return { tool: "lookup_ticker", ok: false, output: `finnhub ${res.status}` };
    const j = (await res.json()) as { c?: number; h?: number; l?: number; o?: number; pc?: number };
    return { tool: "lookup_ticker", ok: true, output: `${symbol}: c=${j.c} pc=${j.pc} h=${j.h} l=${j.l} o=${j.o}` };
  } catch (err) {
    return { tool: "lookup_ticker", ok: false, output: `lookup_ticker error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

interface TavilyHit { title?: string; url?: string; content?: string }
async function execWebSearch(query: string): Promise<ToolResult> {
  if (!ENV.webSearchProvider || !ENV.webSearchApiKey) {
    return { tool: "web_search", ok: false, output: "web_search: not configured (WEB_SEARCH_PROVIDER + WEB_SEARCH_API_KEY)" };
  }
  if (!query || typeof query !== "string" || query.length > 300) {
    return { tool: "web_search", ok: false, output: "web_search: invalid query" };
  }
  try {
    if (ENV.webSearchProvider === "tavily") {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_key: ENV.webSearchApiKey, query, max_results: 5, search_depth: "basic" }),
      });
      if (!res.ok) return { tool: "web_search", ok: false, output: `tavily ${res.status}` };
      const j = (await res.json()) as { results?: TavilyHit[] };
      const summary = (j.results ?? []).slice(0, 5).map((r, i) => `${i + 1}. ${r.title} — ${r.url}\n${(r.content ?? "").slice(0, 200)}`).join("\n");
      return { tool: "web_search", ok: true, output: summary || "no results" };
    }
    return { tool: "web_search", ok: false, output: `web_search: provider '${ENV.webSearchProvider}' not implemented` };
  } catch (err) {
    return { tool: "web_search", ok: false, output: `web_search error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
  // length (base: meter)
  m: { m: 1, cm: 100, mm: 1000, km: 0.001, in: 39.3701, ft: 3.28084, yd: 1.09361, mi: 0.000621371 },
  // mass (base: gram)
  g: { g: 1, kg: 0.001, mg: 1000, oz: 0.035274, lb: 0.00220462 },
  // temperature handled separately
};

function findUnitFamily(unit: string): string | null {
  const u = unit.toLowerCase();
  for (const [base, table] of Object.entries(UNIT_CONVERSIONS)) {
    if (u in table) return base;
  }
  return null;
}

async function execLookupPolymarket(arg: string): Promise<ToolResult> {
  if (!arg || typeof arg !== "string") {
    return { tool: "lookup_polymarket", ok: false, output: "lookup_polymarket: provide a slug or query" };
  }
  try {
    const { getYesProbability, searchMarkets } = await import("./polymarket");
    // If it looks like a slug (no spaces, lowercase-with-dashes), fetch directly.
    if (/^[a-z0-9-]{4,}$/i.test(arg)) {
      const { prob, market } = await getYesProbability(arg);
      if (!market) return { tool: "lookup_polymarket", ok: false, output: `no market found for slug "${arg}"` };
      const liq = market.liquidityNum ? ` liq=$${Math.round(market.liquidityNum)}` : "";
      return { tool: "lookup_polymarket", ok: true, output: `${market.question} — Yes implied prob ${prob !== null ? (prob * 100).toFixed(1) + "%" : "n/a"}${liq} (${market.url})` };
    }
    // Otherwise treat as search query
    const results = await searchMarkets(arg, 5);
    if (results.length === 0) return { tool: "lookup_polymarket", ok: false, output: `no markets matching "${arg}"` };
    return { tool: "lookup_polymarket", ok: true, output: results.map((m, i) => `${i + 1}. ${m.question} — slug=${m.slug}` + (m.outcomePrices?.[0] !== undefined ? ` yes=${(m.outcomePrices[0] * 100).toFixed(0)}%` : "")).join("\n") };
  } catch (err) {
    return { tool: "lookup_polymarket", ok: false, output: `lookup_polymarket error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function execPullRecentPosts(args: { source?: string; query?: string; limit?: number }): Promise<ToolResult> {
  try {
    const { pullRecentPosts, isApifyConfigured } = await import("./apify-ingest");
    if (!isApifyConfigured()) {
      return { tool: "pull_recent_posts", ok: false, output: "pull_recent_posts: APIFY_API_TOKEN not configured" };
    }
    const source = String(args.source ?? "web").toLowerCase();
    const query = String(args.query ?? "");
    const limit = Math.min(20, Math.max(1, Number(args.limit ?? 10)));
    if (!query) return { tool: "pull_recent_posts", ok: false, output: "pull_recent_posts: 'query' required" };
    const posts = await pullRecentPosts({ source: source as "twitter" | "reddit" | "web", query, limit });
    if (posts.length === 0) return { tool: "pull_recent_posts", ok: true, output: `no recent ${source} posts for "${query}"` };
    return {
      tool: "pull_recent_posts",
      ok: true,
      output: posts.map((p, i) => `${i + 1}. ${p.author ? `@${p.author}: ` : ""}${(p.text ?? "").slice(0, 280)}${p.url ? ` (${p.url})` : ""}`).join("\n"),
    };
  } catch (err) {
    return { tool: "pull_recent_posts", ok: false, output: `pull_recent_posts error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function execConvertUnit(value: number, from: string, to: string): ToolResult {
  if (typeof value !== "number" || !isFinite(value)) {
    return { tool: "convert_unit", ok: false, output: "convert_unit: invalid value" };
  }
  // Temperature special-case
  const f = from.toLowerCase();
  const t = to.toLowerCase();
  if ([f, t].every((u) => ["c", "f", "k", "celsius", "fahrenheit", "kelvin"].includes(u))) {
    let c: number;
    if (f.startsWith("c")) c = value;
    else if (f.startsWith("f")) c = (value - 32) * 5 / 9;
    else c = value - 273.15;
    let out: number;
    if (t.startsWith("c")) out = c;
    else if (t.startsWith("f")) out = c * 9 / 5 + 32;
    else out = c + 273.15;
    return { tool: "convert_unit", ok: true, output: `${value}${from} = ${out.toFixed(4)}${to}` };
  }
  const family = findUnitFamily(f);
  if (!family || family !== findUnitFamily(t)) {
    return { tool: "convert_unit", ok: false, output: `convert_unit: cannot convert ${from} to ${to}` };
  }
  const baseValue = value / UNIT_CONVERSIONS[family][f];
  const result = baseValue * UNIT_CONVERSIONS[family][t];
  return { tool: "convert_unit", ok: true, output: `${value}${from} = ${result.toFixed(6)}${to}` };
}

export async function executeTool(call: ToolCall): Promise<ToolResult> {
  switch (call.tool) {
    case "calc":
      return execCalc(String(call.args.expression ?? ""));
    case "current_date":
      return execCurrentDate();
    case "lookup_ticker":
      return execLookupTicker(String(call.args.symbol ?? ""));
    case "web_search":
      return execWebSearch(String(call.args.query ?? ""));
    case "convert_unit":
      return execConvertUnit(Number(call.args.value), String(call.args.from ?? ""), String(call.args.to ?? ""));
    case "lookup_polymarket":
      return execLookupPolymarket(String(call.args.slug ?? call.args.query ?? ""));
    case "pull_recent_posts":
      return execPullRecentPosts(call.args as { source?: string; query?: string; limit?: number });
    default:
      return { tool: call.tool, ok: false, output: `unknown tool: ${call.tool}` };
  }
}

export function toolsAvailableFor(projectType: "narrative" | "technical" | "finance"): ToolName[] {
  // Narrative: discourse-aware tools (live posts), no math.
  // Technical: math + units + (optional) web search.
  // Finance: ticker + polymarket benchmark + math + (optional) web search + (optional) live posts.
  const apifyOn = Boolean(process.env.APIFY_API_TOKEN);
  if (projectType === "technical") {
    const list: ToolName[] = ["calc", "convert_unit", "current_date"];
    if (ENV.webSearchApiKey) list.push("web_search");
    if (apifyOn) list.push("pull_recent_posts");
    return list;
  }
  if (projectType === "finance") {
    const list: ToolName[] = ["calc", "current_date", "lookup_ticker", "lookup_polymarket"];
    if (ENV.webSearchApiKey) list.push("web_search");
    if (apifyOn) list.push("pull_recent_posts");
    return list;
  }
  // narrative
  const list: ToolName[] = ["current_date", "lookup_polymarket"];
  if (apifyOn) list.push("pull_recent_posts");
  return list;
}

export function describeToolsForPrompt(tools: ToolName[]): string {
  if (tools.length === 0) return "";
  const descriptions: Record<ToolName, string> = {
    calc: `calc({ "expression": "<arithmetic>" }) — evaluates numeric expressions only`,
    current_date: `current_date({}) — returns today's ISO date`,
    lookup_ticker: `lookup_ticker({ "symbol": "AAPL" }) — returns prev-day OHLCV from Polygon/Finnhub`,
    web_search: `web_search({ "query": "<search>" }) — returns top 5 results with snippets`,
    convert_unit: `convert_unit({ "value": <num>, "from": "<unit>", "to": "<unit>" }) — converts length/mass/temperature`,
    lookup_polymarket: `lookup_polymarket({ "slug": "<polymarket-slug>" } or { "query": "<search>" }) — returns market-implied probability and metadata`,
    pull_recent_posts: `pull_recent_posts({ "source": "twitter|reddit|web", "query": "<search>", "limit": <n> }) — scrapes the most recent N posts/results matching the query via Apify`,
  };
  return [
    "TOOLS — you may include a single \"toolCall\" in your decision JSON if helpful:",
    ...tools.map((t) => "  - " + descriptions[t]),
    'Schema: "toolCall": { "tool": "<name>", "args": { ... } }. The runner will execute it and inject the result into your next round.',
  ].join("\n");
}
