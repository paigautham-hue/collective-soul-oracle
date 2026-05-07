/**
 * Finnhub Stock API fetcher
 * Free tier: 60 req/min. Requires API key.
 * Set FINNHUB_API_KEY env var.
 */

export interface FinnhubNewsItem {
  id: number;
  headline: string;
  summary: string;
  source: string;
  datetime: number;
  url: string;
  category: string;
  sentiment?: number;
}

export interface FinnhubQuote {
  c: number;  // current price
  h: number;  // high
  l: number;  // low
  o: number;  // open
  pc: number; // previous close
  t: number;  // timestamp
}

export interface FinnhubResult {
  source: "finnhub";
  query: string;
  news: FinnhubNewsItem[];
  quote?: FinnhubQuote;
  extractedText: string;
}

export async function fetchFinnhub(query: string, symbol?: string): Promise<FinnhubResult> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    throw new Error("FINNHUB_API_KEY not set. Get a free key at https://finnhub.io/");
  }

  const headers = { "X-Finnhub-Token": apiKey };
  const news: FinnhubNewsItem[] = [];
  let quote: FinnhubQuote | undefined;

  if (symbol) {
    // Fetch company news for a specific ticker
    const today = new Date();
    const from = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = today.toISOString().slice(0, 10);
    const newsRes = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}`,
      { headers, signal: AbortSignal.timeout(10000) }
    );
    if (newsRes.ok) {
      const items = await newsRes.json() as FinnhubNewsItem[];
      news.push(...items.slice(0, 15));
    }
    // Fetch quote
    const quoteRes = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}`, {
      headers, signal: AbortSignal.timeout(8000),
    });
    if (quoteRes.ok) quote = await quoteRes.json() as FinnhubQuote;
  } else {
    // General market news
    const newsRes = await fetch(`https://finnhub.io/api/v1/news?category=general`, {
      headers, signal: AbortSignal.timeout(10000),
    });
    if (newsRes.ok) {
      const items = await newsRes.json() as FinnhubNewsItem[];
      // Filter by query keyword
      const q = query.toLowerCase();
      news.push(...items.filter((n) => n.headline.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q)).slice(0, 15));
    }
  }

  const quoteText = quote
    ? `\nCurrent Price: $${quote.c} | High: $${quote.h} | Low: $${quote.l} | Prev Close: $${quote.pc}`
    : "";

  const extractedText = [
    symbol ? `Market data for ${symbol}:${quoteText}` : "",
    news.map((n) => `[${new Date(n.datetime * 1000).toISOString().slice(0, 10)}] ${n.headline}\n${n.summary.slice(0, 300)}\nURL: ${n.url}`).join("\n\n---\n\n"),
  ].filter(Boolean).join("\n\n");

  return { source: "finnhub", query, news, quote, extractedText };
}
