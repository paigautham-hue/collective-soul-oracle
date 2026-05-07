/**
 * YouTube Data API v3 fetcher
 * Free tier: 10,000 units/day. Requires API key.
 * Set YOUTUBE_API_KEY env var. Get key at https://console.cloud.google.com/
 */

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  viewCount?: string;
  likeCount?: string;
  commentCount?: string;
  url: string;
}

export interface YouTubeResult {
  source: "youtube";
  query: string;
  videos: YouTubeVideo[];
  extractedText: string;
}

export async function fetchYouTube(query: string, maxResults = 10): Promise<YouTubeResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY not set. Get a free key at https://console.cloud.google.com/");
  }

  // Search for videos
  const searchParams = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: String(maxResults),
    order: "relevance",
    key: apiKey,
  });
  const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!searchRes.ok) throw new Error(`YouTube API error: ${searchRes.status}`);
  const searchData = await searchRes.json() as {
    items: Array<{
      id: { videoId: string };
      snippet: { title: string; description: string; channelTitle: string; publishedAt: string };
    }>;
  };

  const videoIds = searchData.items.map((i) => i.id.videoId).join(",");
  let statsMap: Record<string, { viewCount?: string; likeCount?: string; commentCount?: string }> = {};

  if (videoIds) {
    const statsParams = new URLSearchParams({
      part: "statistics",
      id: videoIds,
      key: apiKey,
    });
    const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${statsParams}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (statsRes.ok) {
      const statsData = await statsRes.json() as { items: Array<{ id: string; statistics: { viewCount?: string; likeCount?: string; commentCount?: string } }> };
      for (const item of statsData.items) statsMap[item.id] = item.statistics;
    }
  }

  const videos: YouTubeVideo[] = searchData.items.map((item) => ({
    id: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    ...statsMap[item.id.videoId],
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }));

  const extractedText = videos
    .map((v) => `[YouTube] ${v.title} by ${v.channelTitle} (${v.publishedAt.slice(0, 10)})\nViews: ${v.viewCount ?? "N/A"} | Likes: ${v.likeCount ?? "N/A"}\n${v.description.slice(0, 300)}\nURL: ${v.url}`)
    .join("\n\n---\n\n");

  return { source: "youtube", query, videos, extractedText };
}
