/**
 * OpenAlex API fetcher
 * Free, no API key required. 250M+ scholarly works.
 */

export interface OpenAlexWork {
  id: string;
  title: string;
  abstract_inverted_index?: Record<string, number[]>;
  publication_year?: number;
  cited_by_count: number;
  open_access: { is_oa: boolean; oa_url?: string };
  authorships: Array<{ author: { display_name: string } }>;
  primary_location?: { source?: { display_name: string } };
  doi?: string;
}

export interface OpenAlexResult {
  source: "openalex";
  query: string;
  works: OpenAlexWork[];
  extractedText: string;
}

function invertedIndexToAbstract(index?: Record<string, number[]>): string {
  if (!index) return "";
  const words: Array<[number, string]> = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) words.push([pos, word]);
  }
  words.sort((a, b) => a[0] - b[0]);
  return words.map((w) => w[1]).join(" ");
}

export async function fetchOpenAlex(query: string, limit = 10): Promise<OpenAlexResult> {
  const params = new URLSearchParams({
    search: query,
    per_page: String(limit),
    sort: "cited_by_count:desc",
    mailto: "oracle@collectivesoul.app",
  });
  const res = await fetch(`https://api.openalex.org/works?${params}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`OpenAlex API error: ${res.status}`);
  const data = await res.json() as { results: OpenAlexWork[] };
  const works = data.results || [];

  const extractedText = works
    .map((w) => {
      const authors = w.authorships.slice(0, 3).map((a) => a.author.display_name).join(", ");
      const abstract = invertedIndexToAbstract(w.abstract_inverted_index).slice(0, 400);
      const journal = w.primary_location?.source?.display_name ?? "Unknown journal";
      const url = w.open_access.oa_url ?? (w.doi ? `https://doi.org/${w.doi}` : w.id);
      return `Title: ${w.title}\nAuthors: ${authors}\nYear: ${w.publication_year ?? "N/A"} | Citations: ${w.cited_by_count} | Journal: ${journal}\nAbstract: ${abstract}\nURL: ${url}`;
    })
    .join("\n\n---\n\n");

  return { source: "openalex", query, works, extractedText };
}
