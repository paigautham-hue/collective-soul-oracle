/**
 * Wikipedia REST API fetcher
 * Free, no API key required.
 */

export interface WikiSummary {
  title: string;
  extract: string;
  description?: string;
  thumbnail?: { source: string };
  content_urls: { desktop: { page: string } };
}

export interface WikiSearchResult {
  title: string;
  snippet: string;
  pageid: number;
}

export interface WikiResult {
  source: "wikipedia";
  query: string;
  articles: WikiSummary[];
  extractedText: string;
}

export async function fetchWikipedia(query: string, maxArticles = 5): Promise<WikiResult> {
  // Step 1: search for relevant pages
  const searchParams = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: String(maxArticles),
    format: "json",
    origin: "*",
  });
  const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?${searchParams}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!searchRes.ok) throw new Error(`Wikipedia search error: ${searchRes.status}`);
  const searchData = await searchRes.json() as { query: { search: WikiSearchResult[] } };
  const titles = searchData.query.search.map((r) => r.title);

  // Step 2: fetch summaries for each title
  const articles: WikiSummary[] = [];
  for (const title of titles.slice(0, maxArticles)) {
    try {
      const summaryRes = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (summaryRes.ok) {
        const summary = await summaryRes.json() as WikiSummary;
        articles.push(summary);
      }
    } catch {
      // skip failed articles
    }
  }

  const extractedText = articles
    .map((a) => `Title: ${a.title}\nDescription: ${a.description ?? ""}\nSummary: ${a.extract}\nURL: ${a.content_urls.desktop.page}`)
    .join("\n\n---\n\n");

  return { source: "wikipedia", query, articles, extractedText };
}
