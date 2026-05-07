/**
 * Alpha Vantage API fetcher
 * Free tier: 25 req/day. Requires API key.
 * Set ALPHA_VANTAGE_API_KEY env var.
 */

export interface AVNewsItem {
  title: string;
  url: string;
  time_published: string;
  summary: string;
  source: string;
  overall_sentiment_label: string;
  overall_sentiment_score: number;
  topics: Array<{ topic: string; relevance_score: string }>;
}

export interface AVResult {
  source: "alphavantage";
  query: string;
  news: AVNewsItem[];
  extractedText: string;
}

export async function fetchAlphaVantage(query: string, tickers?: string): Promise<AVResult> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    throw new Error("ALPHA_VANTAGE_API_KEY not set. Get a free key at https://www.alphavantage.co/support/#api-key");
  }

  const params = new URLSearchParams({
    function: "NEWS_SENTIMENT",
    apikey: apiKey,
    limit: "15",
    sort: "RELEVANCE",
  });
  if (tickers) params.set("tickers", tickers);
  else params.set("topics", query.replace(/\s+/g, "_").toLowerCase());

  const res = await fetch(`https://www.alphavantage.co/query?${params}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Alpha Vantage API error: ${res.status}`);
  const data = await res.json() as { feed?: AVNewsItem[]; Information?: string };
  if (data.Information) throw new Error(`Alpha Vantage: ${data.Information}`);
  const news = data.feed || [];

  const extractedText = news
    .map((n) => `[${n.time_published}] ${n.title} (${n.source}, sentiment: ${n.overall_sentiment_label})\n${n.summary.slice(0, 400)}\nURL: ${n.url}`)
    .join("\n\n---\n\n");

  return { source: "alphavantage", query, news, extractedText };
}
