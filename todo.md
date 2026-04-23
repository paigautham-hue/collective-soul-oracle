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
- [ ] Generate and upload PWA icons (icon-192.png, icon-512.png)
- [ ] Service worker for offline caching (future enhancement)
- [ ] MiroFish Python backend integration (Zep Cloud, OASIS — requires separate Python env)
