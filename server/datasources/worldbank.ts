/**
 * World Bank Open Data API fetcher
 * Free, no API key required.
 */

export interface WBIndicator {
  id: string;
  name: string;
  sourceNote: string;
}

export interface WBDataPoint {
  country: { id: string; value: string };
  indicator: { id: string; value: string };
  date: string;
  value: number | null;
}

export interface WBResult {
  source: "worldbank";
  query: string;
  indicators: WBIndicator[];
  data: WBDataPoint[];
  extractedText: string;
}

// Common World Bank indicator IDs
const COMMON_INDICATORS: Record<string, string> = {
  gdp: "NY.GDP.MKTP.CD",
  "gdp growth": "NY.GDP.MKTP.KD.ZG",
  population: "SP.POP.TOTL",
  poverty: "SI.POV.DDAY",
  inflation: "FP.CPI.TOTL.ZG",
  unemployment: "SL.UEM.TOTL.ZS",
  "life expectancy": "SP.DYN.LE00.IN",
  education: "SE.ADT.LITR.ZS",
  "co2 emissions": "EN.ATM.CO2E.PC",
  "internet users": "IT.NET.USER.ZS",
  "trade gdp": "NE.TRD.GNFS.ZS",
  "military spending": "MS.MIL.XPND.GD.ZS",
};

export async function fetchWorldBank(query: string, countryCode = "WLD"): Promise<WBResult> {
  const q = query.toLowerCase();
  let indicatorId = "NY.GDP.MKTP.CD"; // default to GDP
  for (const [keyword, id] of Object.entries(COMMON_INDICATORS)) {
    if (q.includes(keyword)) { indicatorId = id; break; }
  }

  const [indicatorRes, dataRes] = await Promise.all([
    fetch(`https://api.worldbank.org/v2/indicator/${indicatorId}?format=json`, { signal: AbortSignal.timeout(10000) }),
    fetch(`https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicatorId}?format=json&mrv=10&per_page=10`, { signal: AbortSignal.timeout(10000) }),
  ]);

  const indicators: WBIndicator[] = [];
  if (indicatorRes.ok) {
    const iData = await indicatorRes.json() as [unknown, WBIndicator[]];
    if (Array.isArray(iData) && iData[1]) indicators.push(...iData[1].slice(0, 1));
  }

  const data: WBDataPoint[] = [];
  if (dataRes.ok) {
    const dData = await dataRes.json() as [unknown, WBDataPoint[]];
    if (Array.isArray(dData) && dData[1]) data.push(...dData[1].filter((d) => d.value !== null));
  }

  const indicator = indicators[0];
  const extractedText = [
    indicator ? `Indicator: ${indicator.name}\n${indicator.sourceNote?.slice(0, 300)}` : "",
    data.length > 0
      ? `Recent data (${countryCode}):\n${data.slice(0, 8).map((d) => `  ${d.date}: ${d.value?.toLocaleString() ?? "N/A"}`).join("\n")}`
      : "No data available.",
  ].filter(Boolean).join("\n\n");

  return { source: "worldbank", query, indicators, data, extractedText };
}
