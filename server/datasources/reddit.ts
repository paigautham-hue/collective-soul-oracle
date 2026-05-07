/**
 * Reddit public JSON API fetcher
 * Free, no API key required for read-only public data.
 * Uses the old.reddit.com JSON endpoint which doesn't require OAuth.
 */

export interface RedditPost {
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  url: string;
  subreddit: string;
  author: string;
  created_utc: number;
  permalink: string;
}

export interface RedditResult {
  source: "reddit";
  query: string;
  posts: RedditPost[];
  extractedText: string;
}

export async function fetchReddit(query: string, subreddit?: string, limit = 15): Promise<RedditResult> {
  let url: string;
  if (subreddit) {
    url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=${limit}&restrict_sr=1&t=month`;
  } else {
    url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=${limit}&t=month`;
  }

  const res = await fetch(url, {
    headers: { "User-Agent": "CollectiveSoulOracle/1.0 (research tool)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Reddit API error: ${res.status}`);
  const data = await res.json() as { data: { children: Array<{ data: RedditPost }> } };
  const posts = data.data.children.map((c) => c.data);

  const extractedText = posts
    .map((p) => {
      const body = p.selftext ? `\n${p.selftext.slice(0, 500)}` : "";
      return `[r/${p.subreddit}] ${p.title} (↑${p.score}, ${p.num_comments} comments)${body}\nURL: https://reddit.com${p.permalink}`;
    })
    .join("\n\n---\n\n");

  return { source: "reddit", query, posts, extractedText };
}
