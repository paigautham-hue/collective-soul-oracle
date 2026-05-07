/**
 * PubMed E-utilities API fetcher
 * Free, no API key required (higher rate limits with NCBI_API_KEY).
 * Set NCBI_API_KEY env var for 10 req/sec instead of 3 req/sec.
 */

export interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  pubDate: string;
  doi?: string;
  url: string;
}

export interface PubMedResult {
  source: "pubmed";
  query: string;
  articles: PubMedArticle[];
  extractedText: string;
}

export async function fetchPubMed(query: string, limit = 10): Promise<PubMedResult> {
  const apiKey = process.env.NCBI_API_KEY;
  const baseParams: Record<string, string> = { db: "pubmed", retmode: "json" };
  if (apiKey) baseParams.api_key = apiKey;

  // Step 1: search for PMIDs
  const searchParams = new URLSearchParams({
    ...baseParams,
    term: query,
    retmax: String(limit),
    sort: "relevance",
  });
  const searchRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!searchRes.ok) throw new Error(`PubMed search error: ${searchRes.status}`);
  const searchData = await searchRes.json() as { esearchresult: { idlist: string[] } };
  const pmids = searchData.esearchresult.idlist;
  if (pmids.length === 0) return { source: "pubmed", query, articles: [], extractedText: "No results found." };

  // Step 2: fetch summaries
  const summaryParams = new URLSearchParams({
    ...baseParams,
    id: pmids.join(","),
  });
  const summaryRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${summaryParams}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!summaryRes.ok) throw new Error(`PubMed summary error: ${summaryRes.status}`);
  const summaryData = await summaryRes.json() as {
    result: Record<string, {
      uid: string;
      title: string;
      source: string;
      pubdate: string;
      authors: Array<{ name: string }>;
      elocationid?: string;
    }>;
  };

  const articles: PubMedArticle[] = pmids
    .map((pmid) => {
      const s = summaryData.result[pmid];
      if (!s) return null;
      const doi = s.elocationid?.replace("doi: ", "");
      return {
        pmid,
        title: s.title,
        abstract: "",
        authors: (s.authors || []).slice(0, 5).map((a) => a.name),
        journal: s.source,
        pubDate: s.pubdate,
        doi,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      } as PubMedArticle;
    })
    .filter((a): a is PubMedArticle => a !== null);

  const extractedText = articles
    .map((a) => `Title: ${a.title}\nAuthors: ${a.authors.join(", ")}\nJournal: ${a.journal} (${a.pubDate})\nURL: ${a.url}`)
    .join("\n\n---\n\n");

  return { source: "pubmed", query, articles, extractedText };
}
