// Apify ingest — controlled scrapers for live discourse / web content.
//
// Used both as an agent tool (pull_recent_posts) and as a project ingest
// option (Wizard step 1 alternative to manual upload). Three actors wrapped:
//
//   apify/rag-web-browser     — general-purpose web search + content fetch
//   apidojo/tweet-scraper     — X / Twitter timeline scraper
//   trudax/reddit-scraper     — Reddit posts/comments
//
// Each actor's input schema is slightly different, so wrappers normalise to
// a common Post[] shape.

import { ENV } from "./_core/env";

const APIFY_BASE = "https://api.apify.com/v2";

export interface Post {
  source: "twitter" | "reddit" | "web";
  text: string;
  author?: string;
  url?: string;
  publishedAt?: string;
  meta?: Record<string, unknown>;
}

export function isApifyConfigured(): boolean {
  return Boolean(ENV.apifyApiToken);
}

interface RunOptions {
  actorId: string;
  input: Record<string, unknown>;
  // Use sync run to avoid polling — fine for small scrapes (≤30s).
  // Apify returns the dataset directly when we use the run-sync-get-dataset endpoint.
  timeoutSecs?: number;
}

async function runActor<T = unknown>({ actorId, input, timeoutSecs = 60 }: RunOptions): Promise<T[]> {
  if (!isApifyConfigured()) throw new Error("APIFY_API_TOKEN not configured");
  // Apify accepts both `org/actor` and `org~actor` in the URL; latter is safer.
  const safeId = actorId.replace("/", "~");
  const url = `${APIFY_BASE}/acts/${safeId}/run-sync-get-dataset-items?token=${ENV.apifyApiToken}&timeout=${timeoutSecs}&clean=true&format=json`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Apify ${actorId} ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data as T[];
}

// ─── X / Twitter ──────────────────────────────────────────────────────────────
interface TweetItem {
  id?: string;
  text?: string;
  fullText?: string;
  author?: { userName?: string; name?: string };
  createdAt?: string;
  url?: string;
  likeCount?: number;
  retweetCount?: number;
}

export async function scrapeTweets(query: string, limit = 20): Promise<Post[]> {
  const items = await runActor<TweetItem>({
    actorId: "apidojo/tweet-scraper",
    input: { searchTerms: [query], maxItems: limit, sort: "Latest" },
    timeoutSecs: 90,
  });
  return items.map((t) => ({
    source: "twitter" as const,
    text: t.fullText ?? t.text ?? "",
    author: t.author?.userName ?? t.author?.name,
    url: t.url,
    publishedAt: t.createdAt,
    meta: { likes: t.likeCount, retweets: t.retweetCount },
  })).filter((p) => p.text);
}

// ─── Reddit ───────────────────────────────────────────────────────────────────
interface RedditItem {
  title?: string;
  body?: string;
  text?: string;
  username?: string;
  url?: string;
  createdAt?: string;
  upvotes?: number;
  numberOfComments?: number;
}

export async function scrapeReddit(query: string, limit = 20): Promise<Post[]> {
  const items = await runActor<RedditItem>({
    actorId: "trudax/reddit-scraper",
    input: { searches: [query], maxItems: limit, sort: "new", type: "post" },
    timeoutSecs: 90,
  });
  return items.map((r) => ({
    source: "reddit" as const,
    text: [r.title, r.body ?? r.text].filter(Boolean).join(" — ").slice(0, 1200),
    author: r.username,
    url: r.url,
    publishedAt: r.createdAt,
    meta: { upvotes: r.upvotes, comments: r.numberOfComments },
  })).filter((p) => p.text);
}

// ─── General web (RAG-friendly) ───────────────────────────────────────────────
interface WebItem {
  url?: string;
  title?: string;
  metadata?: { title?: string; description?: string };
  markdown?: string;
  text?: string;
  description?: string;
}

export async function scrapeWeb(query: string, limit = 5): Promise<Post[]> {
  const items = await runActor<WebItem>({
    actorId: "apify/rag-web-browser",
    input: { query, maxResults: limit, outputFormats: ["markdown"] },
    timeoutSecs: 90,
  });
  return items.map((w) => ({
    source: "web" as const,
    text: (w.markdown ?? w.text ?? w.description ?? w.metadata?.description ?? "").slice(0, 2000),
    author: w.title ?? w.metadata?.title,
    url: w.url,
  })).filter((p) => p.text);
}

// ─── Unified entry-point used by agent tool + ingest UI ──────────────────────
export async function pullRecentPosts(opts: { source: "twitter" | "reddit" | "web"; query: string; limit?: number }): Promise<Post[]> {
  const limit = Math.max(1, Math.min(50, opts.limit ?? 15));
  if (opts.source === "twitter") return scrapeTweets(opts.query, limit);
  if (opts.source === "reddit") return scrapeReddit(opts.query, limit);
  return scrapeWeb(opts.query, Math.min(10, limit));
}
