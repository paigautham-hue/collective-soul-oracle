/**
 * FRED (Federal Reserve Economic Data) API fetcher
 * Free, requires API key.
 * Set FRED_API_KEY env var. Get free key at https://fred.stlouisfed.org/docs/api/api_key.html
 */

export interface FREDSeries {
  id: string;
  title: string;
  frequency: string;
  units: string;
  seasonal_adjustment: string;
  last_updated: string;
  observation_start: string;
  observation_end: string;
}

export interface FREDObservation {
  date: string;
  value: string;
}

export interface FREDResult {
  source: "fred";
  query: string;
  series: FREDSeries[];
  observations: Record<string, FREDObservation[]>;
  extractedText: string;
}

// Common economic series IDs for quick lookup
const COMMON_SERIES: Record<string, string> = {
  gdp: "GDP",
  inflation: "CPIAUCSL",
  unemployment: "UNRATE",
  "federal funds rate": "FEDFUNDS",
  "interest rate": "FEDFUNDS",
  "10 year treasury": "GS10",
  "housing starts": "HOUST",
  "consumer confidence": "UMCSENT",
  "trade balance": "BOPGSTB",
  m2: "M2SL",
};

export async function fetchFRED(query: string, seriesIds?: string[]): Promise<FREDResult> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    throw new Error("FRED_API_KEY not set. Get a free key at https://fred.stlouisfed.org/docs/api/api_key.html");
  }

  // Find matching series IDs from common list or search
  let ids = seriesIds || [];
  if (ids.length === 0) {
    const q = query.toLowerCase();
    for (const [keyword, id] of Object.entries(COMMON_SERIES)) {
      if (q.includes(keyword)) ids.push(id);
    }
  }
  if (ids.length === 0) {
    // Search FRED for series
    const searchRes = await fetch(
      `https://api.stlouisfed.org/fred/series/search?search_text=${encodeURIComponent(query)}&api_key=${apiKey}&file_type=json&limit=5`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (searchRes.ok) {
      const data = await searchRes.json() as { seriess?: FREDSeries[] };
      ids = (data.seriess || []).slice(0, 3).map((s) => s.id);
    }
  }

  const seriesList: FREDSeries[] = [];
  const observations: Record<string, FREDObservation[]> = {};

  for (const id of ids.slice(0, 3)) {
    try {
      const seriesRes = await fetch(
        `https://api.stlouisfed.org/fred/series?series_id=${id}&api_key=${apiKey}&file_type=json`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (seriesRes.ok) {
        const data = await seriesRes.json() as { seriess?: FREDSeries[] };
        if (data.seriess?.[0]) seriesList.push(data.seriess[0]);
      }
      const obsRes = await fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=12`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (obsRes.ok) {
        const data = await obsRes.json() as { observations?: FREDObservation[] };
        observations[id] = data.observations || [];
      }
    } catch { /* skip */ }
  }

  const extractedText = seriesList
    .map((s) => {
      const obs = observations[s.id] || [];
      const recent = obs.slice(0, 6).map((o) => `  ${o.date}: ${o.value} ${s.units}`).join("\n");
      return `${s.title} (${s.id})\nFrequency: ${s.frequency} | Units: ${s.units}\nRecent data:\n${recent}`;
    })
    .join("\n\n---\n\n");

  return { source: "fred", query, series: seriesList, observations, extractedText };
}
