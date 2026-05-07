/**
 * Semantic Scholar Academic Graph API
 * Free, no API key required (rate limit: 100 req/5min unauthenticated).
 */

export interface S2Paper {
  paperId: string;
  title: string;
  abstract?: string;
  year?: number;
  citationCount?: number;
  authors: Array<{ name: string }>;
  externalIds?: { DOI?: string; ArXiv?: string };
  url: string;
}

export interface S2Result {
  source: "semanticscholar";
  query: string;
  papers: S2Paper[];
  extractedText: string;
}

export async function fetchSemanticScholar(query: string, limit = 10): Promise<S2Result> {
  const params = new URLSearchParams({
    query,
    limit: String(limit),
    fields: "paperId,title,abstract,year,citationCount,authors,externalIds,url",
  });
  const res = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?${params}`, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Semantic Scholar API error: ${res.status}`);
  const data = await res.json() as { data?: S2Paper[] };
  const papers = data.data || [];

  const extractedText = papers
    .map((p) => {
      const authors = p.authors.map((a) => a.name).join(", ");
      return `Title: ${p.title}\nAuthors: ${authors}\nYear: ${p.year ?? "N/A"} | Citations: ${p.citationCount ?? 0}\nAbstract: ${p.abstract ?? "No abstract available."}\nURL: ${p.url}`;
    })
    .join("\n\n---\n\n");

  return { source: "semanticscholar", query, papers, extractedText };
}
