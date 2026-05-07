/**
 * GDELT Project fetcher
 * Free, no API key required.
 * Uses the GDELT 2.0 DOC API to search global news events.
 */

export interface GDELTArticle {
  title: string;
  url: string;
  seendate: string;
  domain: string;
  language: string;
  sourcecountry: string;
  socialimage?: string;
}

export interface GDELTResult {
  source: "gdelt";
  query: string;
  articles: GDELTArticle[];
  extractedText: string;
}

export async function fetchGDELT(query: string, maxRecords = 25): Promise<GDELTResult> {
  const params = new URLSearchParams({
    query: query,
    mode: "artlist",
    maxrecords: String(maxRecords),
    sort: "DateDesc",
    format: "json",
    timespan: "2d",
  });
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`GDELT API error: ${res.status}`);
  const data = await res.json() as { articles?: GDELTArticle[] };
  const articles = data.articles || [];

  const extractedText = articles
    .map((a) => `[${a.seendate}] ${a.title} (${a.domain}, ${a.sourcecountry})\nURL: ${a.url}`)
    .join("\n\n");

  return { source: "gdelt", query, articles, extractedText };
}
