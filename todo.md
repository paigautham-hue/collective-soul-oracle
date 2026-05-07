# The Collective Soul: Oracle — TODO

## Phase 2: Design System & DB Schema
- [x] Configure global CSS variables: deep space black, frosted glass, electric indigo, amber gold
- [x] Add Google Fonts: Cinzel, Cormorant Garamond, JetBrains Mono
- [x] Update index.html with PWA manifest link and font imports
- [x] DB schema: projects, simulation_runs, documents, agents, graph_nodes, graph_edges, reports, chat_messages
- [x] Run DB migration

## Phase 3: Backend
- [x] tRPC router: projects (create, list, get, delete)
- [x] tRPC router: documents (upload, list, get)
- [x] tRPC router: simulations (create, start, stop, status, list, logs)
- [x] tRPC router: graph (get, build with LLM ontology extraction)
- [x] tRPC router: reports (get, list, generate with LLM ReACT agent)
- [x] tRPC router: agents (list, generate personas, chat)
- [x] tRPC router: admin (userList, stats)
- [x] LLM router via invokeLLM (routeLLM function for task-specific routing)
- [x] Background simulation runner (runSimulationBackground)
- [x] S3 file upload endpoint (PDF, TXT, DOCX)
- [x] Owner notification on simulation/report completion
- [x] 18 vitest tests — all passing

## Phase 4: Frontend Shell
- [x] Dark theme CSS variables and glassmorphism utility classes
- [x] App.tsx: all routes wired
- [x] TopNav component with auth state (login/logout/avatar dropdown)
- [x] Landing/Dashboard page with animated particle canvas background
- [x] Glowing project cards grid
- [x] "New Simulation" CTA button
- [x] Empty state with call-to-action

## Phase 5: Core Features
- [x] 5-Step Project Wizard (full-screen, step-by-step)
  - [x] Step 1: Seed document upload (drag & drop)
  - [x] Step 2: Ontology & graph building (progress + preview)
  - [x] Step 3: Environment setup (agent config)
  - [x] Step 4: Simulation run (live monitor)
  - [x] Step 5: Report generation
- [x] Knowledge Graph Explorer (WebGL canvas, force-directed, glow effects, node inspection panel)
- [x] Real-Time Simulation Monitor (polling feed, scrolling log terminal in JetBrains Mono)

## Phase 6: Advanced Features
- [x] Report Reader (full markdown report display with Streamdown)
- [x] Agent Chat interface (agent selector sidebar, full chat UI)
- [x] PWA manifest.json
- [x] In-app notifications on task completion (notifyOwner)
- [x] Admin dashboard (user list, role badges)

## Phase 7: QA & Polish
- [x] Responsive design (mobile, tablet, desktop breakpoints)
- [x] All navigation links verified
- [x] Vitest unit tests for all key routers (18 tests passing)
- [x] Generate and upload PWA icons (icon-192.png, icon-512.png)
- [x] Service worker (sw.js) for offline caching of reports and project history, push notifications
- [x] MiroFish integration architecture documented — LLM calls route to invokeLLM; Zep/OASIS requires separate Python env (see MIROFISH_INTEGRATION.md)

## Phase 8: Deep Research Enhancements
- [x] Backend: SSE streaming endpoint for Deep Research thought summaries (/api/research/stream)
- [x] Backend: Collaborative Planning tRPC procedures (createPlan, refinePlan, executePlan)
- [x] Frontend: ResearchProgressPanel component with animated thought stream
- [x] Frontend: Wizard Step 1 — CollaborativePlanReview modal before executing research
- [x] Frontend: Wire SSE stream to progress panel during research run

## Phase 9: AI Prompt Enhancer
- [x] Backend: research.enhancePrompt tRPC procedure — Claude Opus / GPT-4o rewrites raw topic into optimized research prompt
- [x] Frontend: PromptEnhancer component — inline "Enhance" button with diff view (original vs enhanced)
- [x] Frontend: Wire PromptEnhancer into Wizard Step 1 topic input field
- [x] Frontend: ResearchProgressPanel component with animated SSE thought stream
- [x] Frontend: CollaborativePlanReview modal in Wizard Step 1 (createPlan → review → refinePlan → executePlan)

## Phase 10: Document-Grounded Deep Research
- [x] Fix: fold system_instruction into input prompt (Interactions API 400 fix)
- [x] Backend: extend seedProject to embed uploaded doc text as privateContext in Deep Research
- [x] Backend: research.seedFromDocuments procedure — extract themes from docs via LLM, build research plan, run Deep Research with docs as grounding context
- [x] Frontend: Wizard Step 1 — "Research with documents" toggle when files are uploaded
- [x] Frontend: Wizard Step 1 — "Extract research plan from documents" button
- [x] Frontend: ResearchSeedBox — pass uploadedFiles text to backend as privateContext

## Phase 11: Delete & Visual Simulation Monitor
- [x] Add "Delete Project" option to project cards on Dashboard (Home.tsx) with confirmation dialog
- [x] Rebuild SimulationMonitor with stunning graphical rendering: animated agent network canvas, live Recharts activity timeline, per-agent action counters, round-by-round sentiment chart, cinematic log terminal

## Phase 12: PDF Extraction, Simulation Delete, Upload Progress
- [x] Install pdf-parse and @types/pdf-parse, extract real text from uploaded PDFs
- [x] Backend: simulations.deleteRun tRPC procedure to delete a simulation run by id (already existed, upgraded icon to Trash2)
- [x] Frontend: trash icon button on each simulation run row in ProjectDetail.tsx
- [x] Frontend: per-file upload progress bar in Wizard.tsx using XMLHttpRequest

## Phase 13: Multi-Source Data Integration

### Backend: Data Source Fetchers
- [x] Create server/datasources/gdelt.ts — GDELT news events fetcher (free, no key)
- [x] Create server/datasources/semanticscholar.ts — Semantic Scholar paper search (free, no key)
- [x] Create server/datasources/arxiv.ts — arXiv preprint search (free, no key)
- [x] Create server/datasources/wikipedia.ts — Wikipedia article + summary fetcher (free, no key)
- [x] Create server/datasources/reddit.ts — Reddit subreddit top posts/comments (free, no key needed for read)
- [x] Create server/datasources/hackernews.ts — Hacker News top stories + comments (free, no key)
- [x] Create server/datasources/newsdata.ts — NewsData.io news search (free tier, optional API key)
- [x] Create server/datasources/finnhub.ts — Finnhub stock news + sentiment (free tier, optional API key)
- [x] Create server/datasources/alphavantage.ts — Alpha Vantage market data (free tier, optional API key)
- [x] Create server/datasources/coingecko.ts — CoinGecko crypto data (free, no key)
- [x] Create server/datasources/fred.ts — FRED economic indicators (free, no key)
- [x] Create server/datasources/youtube.ts — YouTube video comments/metadata (free tier, optional API key)
- [x] Create server/datasources/openalex.ts — OpenAlex scholarly works (free, no key)
- [x] Create server/datasources/pubmed.ts — PubMed biomedical papers (free, no key)
- [x] Create server/datasources/worldbank.ts — World Bank development indicators (free, no key)
- [x] Create server/datasources/index.ts — unified fetchFromSource(source, query, options) dispatcher

### Backend: tRPC Procedures
- [x] Add datasources.search tRPC procedure — query any source by name + topic, return structured results
- [x] Add datasources.ingest tRPC procedure — fetch + store results as project documents
- [x] Add datasources.list tRPC procedure — list available sources with metadata (name, type, free/paid, description)

### Frontend: Live Data Sources Panel in Wizard Step 1
- [x] Create client/src/components/LiveDataSourcesPanel.tsx — grid of source cards with search input per source
- [x] Wire LiveDataSourcesPanel into Wizard Step 1 below the document upload section
- [x] Show ingested items as document cards (same as uploaded files) with source badge
- [x] Add "Ingest" button per source that calls datasources.ingest and adds to uploadedFiles state

## Phase 14: Smart Data Source Recommendations
- [x] Backend: datasources.recommend tRPC procedure — LLM analyses project topic + type, returns ranked source list with relevance scores and suggested queries
- [x] Frontend: LiveDataSourcesPanel shows "Recommended" badge on top-ranked sources, sorts recommended sources first, auto-fills query fields with LLM-suggested queries
- [x] Frontend: Auto-loads recommendations when panel is first expanded, with loading state banner
