export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Direct provider keys (optional; multi-LLM router prefers these when present, else falls back to Forge)
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  // Embeddings: model + dim (1536 default for text-embedding-3-small)
  embeddingsModel: process.env.EMBEDDINGS_MODEL ?? "text-embedding-3-small",
  embeddingsDim: Number(process.env.EMBEDDINGS_DIM ?? 1536),
  // Finance ingest providers (optional — features degrade gracefully when absent)
  polygonApiKey: process.env.POLYGON_API_KEY ?? "",
  finnhubApiKey: process.env.FINNHUB_API_KEY ?? "",
  // Web search for agent tool-use (optional). Tavily, Brave, or SerpAPI compatible.
  webSearchProvider: process.env.WEB_SEARCH_PROVIDER ?? "",   // 'tavily' | 'brave' | 'serpapi' | ''
  webSearchApiKey: process.env.WEB_SEARCH_API_KEY ?? "",
  // Gemini Deep Research (preview models from Apr 2026 launch).
  // Falls back to GEMINI_API_KEY if a dedicated key isn't provided.
  geminiDeepResearchKey: process.env.GEMINI_DEEP_RESEARCH_API_KEY ?? process.env.GEMINI_API_KEY ?? "",
  deepResearchPreviewModel: process.env.DEEP_RESEARCH_PREVIEW_MODEL ?? "deep-research-preview-04-2026",
  deepResearchMaxModel: process.env.DEEP_RESEARCH_MAX_MODEL ?? "deep-research-max-preview-04-2026",
  // Per-user monthly quota for deep-research calls (each call ~$1-10).
  deepResearchMonthlyQuota: Number(process.env.DEEP_RESEARCH_MONTHLY_QUOTA ?? 25),
};
