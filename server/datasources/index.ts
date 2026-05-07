/**
 * Unified data source dispatcher
 * All sources return { source, query, extractedText, ... }
 */

import { fetchGDELT } from "./gdelt";
import { fetchSemanticScholar } from "./semanticscholar";
import { fetchArXiv } from "./arxiv";
import { fetchWikipedia } from "./wikipedia";
import { fetchReddit } from "./reddit";
import { fetchHackerNews } from "./hackernews";
import { fetchNewsData } from "./newsdata";
import { fetchFinnhub } from "./finnhub";
import { fetchAlphaVantage } from "./alphavantage";
import { fetchCoinGecko } from "./coingecko";
import { fetchFRED } from "./fred";
import { fetchYouTube } from "./youtube";
import { fetchOpenAlex } from "./openalex";
import { fetchPubMed } from "./pubmed";
import { fetchWorldBank } from "./worldbank";

export type DataSourceId =
  | "gdelt"
  | "semanticscholar"
  | "arxiv"
  | "wikipedia"
  | "reddit"
  | "hackernews"
  | "newsdata"
  | "finnhub"
  | "alphavantage"
  | "coingecko"
  | "fred"
  | "youtube"
  | "openalex"
  | "pubmed"
  | "worldbank";

export interface DataSourceMeta {
  id: DataSourceId;
  name: string;
  description: string;
  category: "news" | "academic" | "finance" | "social" | "government";
  requiresKey: boolean;
  keyEnvVar?: string;
  keyUrl?: string;
  free: boolean;
  tags: string[];
}

export const DATA_SOURCES: DataSourceMeta[] = [
  {
    id: "gdelt",
    name: "GDELT Project",
    description: "Real-time global news events in 100+ languages, updated every 15 minutes.",
    category: "news",
    requiresKey: false,
    free: true,
    tags: ["news", "global", "events", "geopolitics", "media"],
  },
  {
    id: "semanticscholar",
    name: "Semantic Scholar",
    description: "200M+ academic papers with abstracts, citations, and author data.",
    category: "academic",
    requiresKey: false,
    free: true,
    tags: ["research", "papers", "citations", "science", "academic"],
  },
  {
    id: "arxiv",
    name: "arXiv",
    description: "Preprints in physics, CS, economics, biology, and more.",
    category: "academic",
    requiresKey: false,
    free: true,
    tags: ["research", "preprints", "science", "technology", "academic"],
  },
  {
    id: "wikipedia",
    name: "Wikipedia",
    description: "Structured article summaries and concept pages.",
    category: "academic",
    requiresKey: false,
    free: true,
    tags: ["encyclopedia", "concepts", "history", "general"],
  },
  {
    id: "reddit",
    name: "Reddit",
    description: "Top posts and community discourse from any subreddit.",
    category: "social",
    requiresKey: false,
    free: true,
    tags: ["social", "community", "opinions", "discourse", "trends"],
  },
  {
    id: "hackernews",
    name: "Hacker News",
    description: "Tech community discussions, startup news, and developer discourse.",
    category: "social",
    requiresKey: false,
    free: true,
    tags: ["tech", "startup", "developer", "social", "community"],
  },
  {
    id: "newsdata",
    name: "NewsData.io",
    description: "97,000+ news sources with sentiment and category tags.",
    category: "news",
    requiresKey: true,
    keyEnvVar: "NEWSDATA_API_KEY",
    keyUrl: "https://newsdata.io/",
    free: true,
    tags: ["news", "sentiment", "global", "media"],
  },
  {
    id: "finnhub",
    name: "Finnhub",
    description: "Stock news, earnings, insider trades, and market sentiment.",
    category: "finance",
    requiresKey: true,
    keyEnvVar: "FINNHUB_API_KEY",
    keyUrl: "https://finnhub.io/",
    free: true,
    tags: ["finance", "stocks", "markets", "earnings", "sentiment"],
  },
  {
    id: "alphavantage",
    name: "Alpha Vantage",
    description: "Financial news with sentiment scores, stock and forex data.",
    category: "finance",
    requiresKey: true,
    keyEnvVar: "ALPHA_VANTAGE_API_KEY",
    keyUrl: "https://www.alphavantage.co/support/#api-key",
    free: true,
    tags: ["finance", "stocks", "forex", "sentiment", "news"],
  },
  {
    id: "coingecko",
    name: "CoinGecko",
    description: "Cryptocurrency prices, market caps, and rankings.",
    category: "finance",
    requiresKey: false,
    free: true,
    tags: ["crypto", "bitcoin", "defi", "markets", "finance"],
  },
  {
    id: "fred",
    name: "FRED (Federal Reserve)",
    description: "800,000+ economic time series: GDP, inflation, unemployment, and more.",
    category: "government",
    requiresKey: true,
    keyEnvVar: "FRED_API_KEY",
    keyUrl: "https://fred.stlouisfed.org/docs/api/api_key.html",
    free: true,
    tags: ["economics", "macroeconomics", "government", "policy", "indicators"],
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "Video metadata, view counts, and channel data for any topic.",
    category: "social",
    requiresKey: true,
    keyEnvVar: "YOUTUBE_API_KEY",
    keyUrl: "https://console.cloud.google.com/",
    free: true,
    tags: ["video", "media", "social", "culture", "trends"],
  },
  {
    id: "openalex",
    name: "OpenAlex",
    description: "250M+ scholarly works with open access links and citation networks.",
    category: "academic",
    requiresKey: false,
    free: true,
    tags: ["research", "papers", "citations", "open access", "academic"],
  },
  {
    id: "pubmed",
    name: "PubMed",
    description: "35M+ biomedical and life science research articles.",
    category: "academic",
    requiresKey: false,
    free: true,
    tags: ["medicine", "biology", "health", "research", "clinical"],
  },
  {
    id: "worldbank",
    name: "World Bank",
    description: "Development indicators for 200+ countries: GDP, poverty, education, health.",
    category: "government",
    requiresKey: false,
    free: true,
    tags: ["development", "economics", "global", "government", "policy"],
  },
];

export interface FetchResult {
  source: DataSourceId;
  query: string;
  extractedText: string;
  itemCount: number;
  error?: string;
}

export async function fetchFromSource(
  sourceId: DataSourceId,
  query: string,
  options?: { symbol?: string; subreddit?: string; countryCode?: string; language?: string }
): Promise<FetchResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;
    switch (sourceId) {
      case "gdelt":
        result = await fetchGDELT(query);
        return { source: sourceId, query, extractedText: result.extractedText, itemCount: (result.articles as unknown[]).length };
      case "semanticscholar":
        result = await fetchSemanticScholar(query);
        return { source: sourceId, query, extractedText: result.extractedText, itemCount: (result.papers as unknown[]).length };
      case "arxiv":
        result = await fetchArXiv(query);
        return { source: sourceId, query, extractedText: result.extractedText, itemCount: (result.papers as unknown[]).length };
      case "wikipedia":
        result = await fetchWikipedia(query);
        return { source: sourceId, query, extractedText: result.extractedText, itemCount: (result.articles as unknown[]).length };
      case "reddit":
        result = await fetchReddit(query, options?.subreddit);
        return { source: sourceId, query, extractedText: result.extractedText, itemCount: (result.posts as unknown[]).length };
      case "hackernews":
        result = await fetchHackerNews(query);
        return { source: sourceId, query, extractedText: result.extractedText, itemCount: (result.stories as unknown[]).length };
      case "newsdata":
        result = await fetchNewsData(query, options?.language);
        return { source: sourceId, query, extractedText: result.extractedText, itemCount: (result.articles as unknown[]).length };
      case "finnhub":
        result = await fetchFinnhub(query, options?.symbol);
        return { source: sourceId, query, extractedText: result.extractedText, itemCount: (result.news as unknown[]).length };
      case "alphavantage":
        result = await fetchAlphaVantage(query, options?.symbol);
        return { source: sourceId, query, extractedText: result.extractedText, itemCount: (result.news as unknown[]).length };
      case "coingecko":
        result = await fetchCoinGecko(query);
        return { source: sourceId, query, extractedText: result.extractedText, itemCount: (result.coins as unknown[]).length };
      case "fred":
        result = await fetchFRED(query);
        return { source: sourceId, query, extractedText: result.extractedText, itemCount: (result.series as unknown[]).length };
      case "youtube":
        result = await fetchYouTube(query);
        return { source: sourceId, query, extractedText: result.extractedText, itemCount: (result.videos as unknown[]).length };
      case "openalex":
        result = await fetchOpenAlex(query);
        return { source: sourceId, query, extractedText: result.extractedText, itemCount: (result.works as unknown[]).length };
      case "pubmed":
        result = await fetchPubMed(query);
        return { source: sourceId, query, extractedText: result.extractedText, itemCount: (result.articles as unknown[]).length };
      case "worldbank":
        result = await fetchWorldBank(query, options?.countryCode);
        return { source: sourceId, query, extractedText: result.extractedText, itemCount: (result.data as unknown[]).length };
      default:
        throw new Error(`Unknown source: ${sourceId}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { source: sourceId, query, extractedText: "", itemCount: 0, error: msg };
  }
}
