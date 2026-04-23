// Polymarket client — public read-only endpoints, no auth required.
//
// Two API surfaces used:
//   gamma-api.polymarket.com — market metadata + search (REST)
//   clob.polymarket.com      — live order books / midpoints
//
// The schemas drift quietly; we keep parsers tolerant.

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";

export interface PolymarketMarketSummary {
  slug: string;
  question: string;
  description?: string;
  volumeNum?: number;
  liquidityNum?: number;
  endDate?: string | null;
  closed?: boolean;
  outcomes?: string[];
  outcomePrices?: number[];      // implied probability per outcome (sums ~1.0)
  url?: string;
}

interface GammaMarketRaw {
  id?: string;
  slug?: string;
  question?: string;
  description?: string;
  volumeNum?: number;
  liquidityNum?: number;
  endDate?: string | null;
  closed?: boolean;
  outcomes?: string;          // JSON-encoded array, sometimes
  outcomePrices?: string;     // JSON-encoded array, sometimes
  url?: string;
}

function parseMaybeJsonArray(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch { return undefined; }
  }
  return undefined;
}

function normalize(raw: GammaMarketRaw): PolymarketMarketSummary {
  const outcomes = (parseMaybeJsonArray(raw.outcomes) ?? []).map((o) => String(o));
  const prices = (parseMaybeJsonArray(raw.outcomePrices) ?? []).map((p) => Number(p));
  return {
    slug: raw.slug ?? "",
    question: raw.question ?? "(untitled market)",
    description: raw.description,
    volumeNum: raw.volumeNum,
    liquidityNum: raw.liquidityNum,
    endDate: raw.endDate ?? null,
    closed: raw.closed ?? false,
    outcomes: outcomes.length > 0 ? outcomes : undefined,
    outcomePrices: prices.length > 0 ? prices : undefined,
    url: raw.slug ? `https://polymarket.com/event/${raw.slug}` : undefined,
  };
}

export async function searchMarkets(query: string, limit = 10): Promise<PolymarketMarketSummary[]> {
  const url = `${GAMMA}/markets?limit=${limit}&active=true&closed=false&order=volumeNum&ascending=false&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`polymarket search ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const list: GammaMarketRaw[] = Array.isArray(data) ? data : (data?.markets ?? []);
  return list.map(normalize).filter((m) => m.slug);
}

export async function getMarket(slug: string): Promise<PolymarketMarketSummary | null> {
  const url = `${GAMMA}/markets?slug=${encodeURIComponent(slug)}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) return null;
  const data = await res.json();
  const list: GammaMarketRaw[] = Array.isArray(data) ? data : (data?.markets ?? []);
  if (list.length === 0) return null;
  return normalize(list[0]);
}

// "Yes" implied probability — most binary markets index outcomes[0]='Yes'.
// We return null when the market's structure isn't trivially binary.
export async function getYesProbability(slug: string): Promise<{ prob: number | null; market: PolymarketMarketSummary | null }> {
  const m = await getMarket(slug);
  if (!m) return { prob: null, market: null };
  if (!m.outcomes || !m.outcomePrices) return { prob: null, market: m };
  const yesIdx = m.outcomes.findIndex((o) => /^yes$/i.test(o));
  const idx = yesIdx >= 0 ? yesIdx : 0;
  const p = m.outcomePrices[idx];
  return { prob: typeof p === "number" && isFinite(p) ? p : null, market: m };
}

export interface MarketResolution {
  resolved: boolean;
  yes?: boolean;        // true if YES outcome won, false if NO/other
  closedAt?: string | null;
}

// Best-effort resolution check. Polymarket's resolution payload has shifted
// over time; we detect the common cases.
export async function getResolution(slug: string): Promise<MarketResolution> {
  const m = await getMarket(slug);
  if (!m) return { resolved: false };
  if (!m.closed) return { resolved: false };
  // If closed and outcomePrices snapped to 1/0, infer winner
  if (m.outcomes && m.outcomePrices && m.outcomePrices.length === m.outcomes.length) {
    const winnerIdx = m.outcomePrices.findIndex((p) => p >= 0.99);
    if (winnerIdx >= 0) {
      const winner = m.outcomes[winnerIdx];
      return { resolved: true, yes: /^yes$/i.test(winner), closedAt: m.endDate ?? null };
    }
  }
  return { resolved: true, closedAt: m.endDate ?? null };
}
