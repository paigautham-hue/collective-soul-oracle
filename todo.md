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
