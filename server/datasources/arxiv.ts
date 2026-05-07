/**
 * arXiv API fetcher
 * Free, no API key required.
 */

export interface ArXivPaper {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  updated: string;
  categories: string[];
  link: string;
}

export interface ArXivResult {
  source: "arxiv";
  query: string;
  papers: ArXivPaper[];
  extractedText: string;
}

export async function fetchArXiv(query: string, maxResults = 10): Promise<ArXivResult> {
  const params = new URLSearchParams({
    search_query: `all:${query}`,
    start: "0",
    max_results: String(maxResults),
    sortBy: "relevance",
    sortOrder: "descending",
  });
  const res = await fetch(`https://export.arxiv.org/api/query?${params}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`arXiv API error: ${res.status}`);
  const xml = await res.text();

  // Parse XML manually (no DOM in Node)
  const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
  const papers: ArXivPaper[] = entries.map((entry) => {
    const get = (tag: string) => {
      const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? m[1].trim() : "";
    };
    const getAll = (tag: string) => {
        const matches = Array.from(entry.matchAll(new RegExp(`<${tag}[^>]*>([\s\S]*?)<\/${tag}>`, "g")));;
      return matches.map((m) => m[1].trim());
    };
    const rawId = get("id");
    const id = rawId.replace("http://arxiv.org/abs/", "");
    return {
      id,
      title: get("title").replace(/\s+/g, " "),
      summary: get("summary").replace(/\s+/g, " "),
      authors: getAll("name"),
      published: get("published"),
      updated: get("updated"),
      categories: getAll("category").map((c) => c.replace(/.*term="([^"]+)".*/, "$1")),
      link: `https://arxiv.org/abs/${id}`,
    };
  });

  const extractedText = papers
    .map((p) => `Title: ${p.title}\nAuthors: ${p.authors.join(", ")}\nPublished: ${p.published.slice(0, 10)}\nAbstract: ${p.summary}\nURL: ${p.link}`)
    .join("\n\n---\n\n");

  return { source: "arxiv", query, papers, extractedText };
}
