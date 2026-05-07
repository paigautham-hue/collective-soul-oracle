/**
 * NewsData.io API fetcher
 * Free tier: 200 requests/day. Optional API key for higher limits.
 * Set NEWSDATA_API_KEY env var to use authenticated requests.
 */

export interface NewsDataArticle {
  article_id: string;
  title: string;
  description?: string;
  content?: string;
  pubDate: string;
  source_id: string;
  country: string[];
  category: string[];
  language: string;
  link: string;
  sentiment?: string;
}

export interface NewsDataResult {
  source: "newsdata";
  query: string;
  articles: NewsDataArticle[];
  extractedText: string;
}

export async function fetchNewsData(query: string, language = "en", limit = 10): Promise<NewsDataResult> {
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) {
    throw new Error("NEWSDATA_API_KEY not set. Get a free key at https://newsdata.io/");
  }
  const params = new URLSearchParams({
    apikey: apiKey,
    q: query,
    language,
    size: String(Math.min(limit, 10)),
  });
  const res = await fetch(`https://newsdata.io/api/1/latest?${params}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`NewsData API error: ${res.status}`);
  const data = await res.json() as { status: string; results?: NewsDataArticle[]; message?: string };
  if (data.status !== "success") throw new Error(`NewsData error: ${data.message}`);
  const articles = data.results || [];

  const extractedText = articles
    .map((a) => {
      const body = a.content || a.description || "";
      return `[${a.pubDate}] ${a.title} (${a.source_id}, ${a.country.join(",")})\n${body.slice(0, 500)}\nURL: ${a.link}`;
    })
    .join("\n\n---\n\n");

  return { source: "newsdata", query, articles, extractedText };
}
