/**
 * CoinGecko API fetcher
 * Free, no API key required for basic endpoints (30 req/min).
 */

export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  total_volume: number;
  market_cap_rank: number;
}

export interface CoinGeckoResult {
  source: "coingecko";
  query: string;
  coins: CoinData[];
  extractedText: string;
}

export async function fetchCoinGecko(query: string, limit = 20): Promise<CoinGeckoResult> {
  // Search for coins matching the query
  const searchRes = await fetch(
    `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (!searchRes.ok) throw new Error(`CoinGecko search error: ${searchRes.status}`);
  const searchData = await searchRes.json() as { coins: Array<{ id: string; name: string; symbol: string }> };
  const coinIds = searchData.coins.slice(0, 5).map((c) => c.id).join(",");

  let coins: CoinData[] = [];
  if (coinIds) {
    const marketRes = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinIds}&order=market_cap_desc&per_page=${limit}&price_change_percentage=7d`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (marketRes.ok) {
      coins = await marketRes.json() as CoinData[];
    }
  } else {
    // Fall back to top coins by market cap
    const marketRes = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&price_change_percentage=7d`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (marketRes.ok) coins = await marketRes.json() as CoinData[];
  }

  const extractedText = coins
    .map((c) => `${c.name} (${c.symbol.toUpperCase()}) | Rank #${c.market_cap_rank} | Price: $${c.current_price.toLocaleString()} | 24h: ${c.price_change_percentage_24h?.toFixed(2)}% | Market Cap: $${(c.market_cap / 1e9).toFixed(2)}B`)
    .join("\n");

  return { source: "coingecko", query, coins, extractedText };
}
