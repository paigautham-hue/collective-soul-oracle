# Collective Soul: Oracle — Claude Code Brief

## What This Is

**Oracle** is a swarm-intelligence prediction engine. Users upload seed documents → system extracts a knowledge graph → generates AI agent personas → runs a multi-agent social simulation → produces a prediction report → user can chat with any agent.

**Inspired by** [MiroFish](https://github.com/666ghj/MiroFish) (Python/Flask + Vue + Zep Cloud + OASIS). Oracle is a from-scratch TypeScript reimplementation that aims to **surpass** MiroFish, not just match it.

**Hosted on** Manus (Manus deployed it; pushes to GitHub `main` trigger redeploys). API keys (Forge, OpenAI, Anthropic, Gemini, Zep) are managed via the Manus dashboard, not in `.env` files locally.

---

## Tech Stack (do not change)

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 7 + TypeScript |
| Routing | wouter (SPA) |
| Styling | Tailwind 4 + shadcn/ui (Radix) |
| 3D viz | React Three Fiber (graph explorer) |
| State/Data | tRPC v11 + React Query |
| Backend | Express + tRPC |
| DB | MySQL + Drizzle ORM |
| Auth | Manus OAuth (via Forge) — JWT cookies |
| LLM | `invokeLLM` → Forge API (default); direct providers via env keys |
| Realtime | Socket.io (server + client installed) |
| Storage | S3 (AWS SDK v3) |
| PWA | vite-plugin-pwa + workbox |
| Tests | Vitest (unit only — no E2E yet) |
| Pkg mgr | **pnpm** (NOT npm) |

---

## Codebase Map

```
collective-soul-oracle/
├── client/src/
│   ├── pages/
│   │   ├── Home.tsx              # Landing
│   │   ├── Wizard.tsx            # 5-step project creation flow
│   │   ├── ProjectDetail.tsx     # Project hub
│   │   ├── GraphExplorer.tsx     # 3D knowledge graph (R3F)
│   │   ├── SimulationMonitor.tsx # Live sim log feed
│   │   ├── ReportReader.tsx      # Markdown report view
│   │   ├── AgentChat.tsx         # Chat with simulated agents
│   │   ├── AdminDashboard.tsx    # Admin panel
│   │   └── ComponentShowcase.tsx # UI lib showcase
│   └── components/ui/            # shadcn/ui primitives
├── server/
│   ├── _core/                    # trpc setup, auth, llm, notifications
│   ├── routers.ts                # ALL tRPC routers (~600 lines)
│   ├── db.ts                     # Drizzle query functions
│   ├── storage.ts                # S3 helpers
│   ├── uploadAndSocket.ts        # Multer + (eventually) Socket.io wiring
│   └── *.test.ts                 # Vitest unit tests
├── drizzle/
│   ├── schema.ts                 # 9 tables (see below)
│   └── migrations/
├── shared/                       # Constants only
├── MIROFISH_INTEGRATION.md       # Architecture spec for MiroFish parity
└── todo.md                       # Original build plan (all phases marked done)
```

---

## Database (drizzle/schema.ts)

**Existing 9 tables** — every new table MUST follow same conventions: autoincrement int PK, snake_case mysql column names matching JS camelCase, `createdAt: timestamp().defaultNow().notNull()`, `updatedAt: timestamp().defaultNow().onUpdateNow().notNull()` where mutable.

| Table | Purpose |
|-------|---------|
| `users` | Auth — openId, role (user/admin) |
| `projects` | 8-state machine: draft → building_graph → graph_ready → setting_up → ready → running → completed/failed |
| `documents` | S3-stored seed files + extracted text |
| `graph_nodes` / `graph_edges` | Knowledge graph extracted by LLM from docs |
| `agents` | Generated personas (name, persona, ideology, platform, followers) |
| `simulation_runs` | Background sim execution (round tracking, status) |
| `simulation_logs` | Per-round agent actions |
| `reports` | Generated markdown reports + PDF metadata |
| `chat_messages` | Agent conversation history per project |

---

## The "5x Better Than MiroFish" Roadmap

This is the active enhancement plan. Work through in order.

### Phase 1 — Close the MiroFish gap

1. **Native vector memory** — new `agent_memories` table (agentId, embedding vec, content, salience, decayedAt). Build `server/embeddings.ts` + `server/memory.ts` with cosine retrieval. No external Zep dependency.
2. **True multi-agent loop** — rewrite simulation runner so each round each agent: observes peers' last actions → retrieves relevant memories → decides action → writes new memory.
3. **Socket.io live streaming** — wire the unused imports; emit `sim:round`, `sim:log`, `sim:done` events; replace polling on SimulationMonitor.
4. **Dynamic graph enrichment** — sim events spawn new `graph_nodes` / `graph_edges`.

### Phase 2 — Beyond MiroFish

5. **Multi-LLM router** — task-routed: Gemini Flash (graph), Claude Opus (personas), GPT (report ReACT), Claude Sonnet (chat). Provider keys via Manus env.
6. **Counterfactual branching** — run N parallel sim branches with perturbations; compare outcomes side-by-side. New table: `simulation_branches`.
7. **Confidence/calibration scoring** — every prediction gets uncertainty bounds; new `predictions` table with confidence + ground-truth slot.
8. **Eval framework** — record predictions → backfill outcomes → score model accuracy over time. Admin dashboard.
9. **PDF/PPTX export** — render reports to PDF (puppeteer or pdfkit) + PPTX (pptxgenjs).
10. **Public share links + REST API** — signed read-only project URLs; documented REST surface.
11. **Real-time collaboration** — multi-user wizard editing via Socket.io presence.

---

## Coding Conventions

### Database (Drizzle)
- Tables in `drizzle/schema.ts`. Always export `type Foo = typeof foo.$inferSelect` AND `type InsertFoo = typeof foo.$inferInsert`.
- Run `pnpm db:push` after schema changes (generates migration + applies).
- All queries go through helper functions in `server/db.ts` — never inline Drizzle in routers.

### tRPC API
- All routers in `server/routers.ts` as sub-routers merged into `appRouter`.
- `protectedProcedure` for authenticated, `publicProcedure` for public, `adminProcedure` (defined inline) for admin.
- Zod input validation: `.input(z.object({ ... }))` (note: imports from `zod/v4`).
- Throw `TRPCError({ code, message })` for errors.

### Frontend
- Pages in `client/src/pages/`. Add routes in app entry (wouter `<Route>`).
- Use shadcn/ui from `@/components/ui/`.
- Data: `trpc.x.y.useQuery()` / `useMutation()`.
- Tailwind only. No CSS modules. No inline styles.
- Icons: `lucide-react`. Charts: `recharts`. Toasts: `sonner`. Animation: `framer-motion`.

### LLM
- Default path: `invokeLLM({ messages })` from `server/_core/llm.ts` — uses Manus Forge.
- Multi-LLM router (Phase 2 #5) lives in new `server/llm-router.ts` and routes by task to direct provider SDKs when keys present, else falls back to Forge.

### Realtime
- Socket.io server attached in `server/_core/index.ts`. Namespaces: `/sim` for simulation events, `/collab` for wizard presence.
- Client uses `socket.io-client` already installed.

---

## Hard Rules

1. **Never break existing functionality.** Wizard, graph build, agent gen, sim, report, chat all work today.
2. **Use pnpm, not npm.** `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm test`.
3. **Commit per sub-feature** with clear messages so Manus redeploys are traceable.
4. **Type safety end-to-end.** No `any` unless absolutely unavoidable. Every new table → exported types. Every new endpoint → Zod input.
5. **No new files unless necessary.** Prefer extending existing modules.
6. **Tests for new server logic.** Vitest, mocked DB + LLM (see `oracle.test.ts` for pattern).
7. **No `.env` writes.** Keys are configured via Manus dashboard. Reference them via `process.env.X`.

---

## Useful Commands

```bash
pnpm install          # First-time setup
pnpm dev              # Dev server (tsx watch + vite)
pnpm build            # Production build
pnpm check            # tsc --noEmit
pnpm test             # vitest run
pnpm db:push          # generate + apply migration
pnpm format           # prettier
```

---

## Current Status (as of audit)

- ✅ All 9 base tables, all routers, all 10 pages, 18 unit tests passing, zero TODOs/FIXMEs in code.
- ❌ No persistent agent memory, no inter-agent dialogue, no live streaming wired, no provider routing, no eval, no exports, no share links.
- The 11-item "5x" roadmap above is the next body of work.
