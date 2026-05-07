/**
 * Hacker News Algolia Search API
 * Free, no API key required.
 */

export interface HNStory {
  objectID: string;
  title: string;
  url?: string;
  story_text?: string;
  author: string;
  points: number;
  num_comments: number;
  created_at: string;
}

export interface HNResult {
  source: "hackernews";
  query: string;
  stories: HNStory[];
  extractedText: string;
}

export async function fetchHackerNews(query: string, limit = 15): Promise<HNResult> {
  const params = new URLSearchParams({
    query,
    tags: "story",
    hitsPerPage: String(limit),
  });
  const res = await fetch(`https://hn.algolia.com/api/v1/search?${params}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HN API error: ${res.status}`);
  const data = await res.json() as { hits: HNStory[] };
  const stories = data.hits;

  const extractedText = stories
    .map((s) => {
      const body = s.story_text ? `\n${s.story_text.replace(/<[^>]+>/g, "").slice(0, 400)}` : "";
      return `[HN] ${s.title} (${s.points} pts, ${s.num_comments} comments, by ${s.author})${body}\nURL: ${s.url ?? `https://news.ycombinator.com/item?id=${s.objectID}`}`;
    })
    .join("\n\n---\n\n");

  return { source: "hackernews", query, stories, extractedText };
}
