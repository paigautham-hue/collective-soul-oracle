# MiroFish Integration Architecture

## Overview

**The Collective Soul: Oracle** is a standalone PWA that replicates and extends MiroFish's AI pipeline. The Oracle backend (Node.js/Express/tRPC) handles all LLM orchestration, while the original MiroFish Python components (Zep Cloud, OASIS) can optionally be connected as a separate service.

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│  Oracle PWA Frontend (React + tRPC)                      │
│  - Dashboard, Wizard, Graph Explorer, Simulation Monitor │
│  - Agent Chat, Report Reader, Admin Dashboard            │
└───────────────────┬─────────────────────────────────────┘
                    │ tRPC over HTTP
┌───────────────────▼─────────────────────────────────────┐
│  Oracle Backend (Node.js + Express + tRPC)               │
│  - Projects, Documents, Agents, Simulations, Reports     │
│  - LLM Router (invokeLLM → Forge API)                    │
│  - S3 File Storage                                       │
│  - MySQL Database (Drizzle ORM)                          │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTP REST (optional)
┌───────────────────▼─────────────────────────────────────┐
│  MiroFish Python Backend (optional, separate process)    │
│  - Flask API on port 5001                                │
│  - Zep Cloud (knowledge graph memory)                    │
│  - OASIS (multi-agent simulation engine)                 │
│  - CAMEL-AI (agent framework)                            │
└─────────────────────────────────────────────────────────┘
```

---

## LLM Routing Strategy

The Oracle backend uses the `routeLLM` function in `server/routers.ts` which calls `invokeLLM` (the Manus Forge LLM API). Task-specific routing:

| Task | Preferred Model | Rationale |
|------|----------------|-----------|
| Graph ontology extraction | Gemini Flash | Large context window, fast, cost-effective for bulk document processing |
| Agent persona generation | Claude Opus | Superior creative writing and nuanced character construction |
| ReACT report generation | GPT-4 / GPT-5 | Best agentic reasoning, tool use, and structured analytical output |
| Agent chat | Claude Sonnet | Balanced quality and speed for interactive conversations |

The `invokeLLM` helper automatically routes to the best available model via the Forge API. Provider-specific calls can be made by passing a `model` parameter.

---

## MiroFish Python Backend Integration

To connect the Oracle PWA to the original MiroFish Python backend:

### 1. Start MiroFish Backend
```bash
cd /path/to/MiroFish/backend
pip install -r requirements.txt
cp .env.example .env  # Fill in ZEP_API_KEY, OPENAI_API_KEY, etc.
python run.py  # Starts Flask on port 5001
```

### 2. Add Environment Variable to Oracle
```
MIROFISH_API_URL=http://localhost:5001
```

### 3. Oracle tRPC Proxy Routes
The Oracle backend can proxy calls to MiroFish endpoints:

| Oracle tRPC Procedure | MiroFish Endpoint | Description |
|----------------------|-------------------|-------------|
| `graph.build` | `POST /api/graph/build` | Trigger Zep knowledge graph construction |
| `agents.generate` | `POST /api/simulation/setup` | Generate OASIS agent personas |
| `simulations.start` | `POST /api/simulation/start` | Start OASIS simulation run |
| `simulations.stop` | `POST /api/simulation/stop` | Stop running simulation |
| `reports.generate` | `POST /api/report/generate` | Trigger ReACT report agent |

### 4. MiroFish API Endpoints Reference

```
GET  /api/graph/status          → Graph build status
POST /api/graph/build           → Build knowledge graph from documents
GET  /api/simulation/status     → Simulation run status
POST /api/simulation/setup      → Setup simulation environment
POST /api/simulation/start      → Start simulation
POST /api/simulation/stop       → Stop simulation
GET  /api/report/status         → Report generation status
POST /api/report/generate       → Generate report
POST /api/interaction/chat      → Chat with agents
```

---

## Zep Cloud Integration

Zep Cloud provides long-term memory for agents. The MiroFish backend uses it for:
- **Knowledge Graph**: Entities, relationships, and ontology extracted from seed documents
- **Agent Memory**: Per-agent conversation history and behavioral patterns
- **Fact Extraction**: Structured facts derived from simulation events

To use Zep directly from Oracle (advanced), install `@getzep/zep-cloud` and authenticate with `ZEP_API_KEY`.

---

## OASIS Simulation Engine

OASIS (from CAMEL-AI) runs the multi-agent social simulation. It requires:
- Python 3.11+
- CAMEL-AI package (`pip install camel-ai`)
- A configured simulation environment (agent personas, platform config, topic)
- GPU optional but recommended for large simulations (>50 agents)

The simulation runs as a background thread in the MiroFish Flask backend, emitting progress events via Server-Sent Events (SSE) on `/api/simulation/stream`.

---

## Data Flow: Full Pipeline

```
1. User uploads seed documents (PDF/TXT/DOCX)
   → Oracle: S3 storage → document record in DB

2. Graph Build triggered
   → Oracle: calls invokeLLM to extract entities/relationships
   → Optional: proxies to MiroFish /api/graph/build (uses Zep Cloud)
   → Oracle: stores graph_nodes + graph_edges in DB

3. Agent Generation triggered
   → Oracle: calls invokeLLM (Claude) to generate agent personas
   → Optional: proxies to MiroFish /api/simulation/setup (uses OASIS)
   → Oracle: stores agents in DB

4. Simulation started
   → Oracle: creates simulation_run record, runs background task
   → Optional: proxies to MiroFish /api/simulation/start (OASIS engine)
   → Oracle: polls/receives logs, stores in simulation_logs

5. Report generated
   → Oracle: calls invokeLLM (GPT-5.4) with ReACT prompting
   → Optional: proxies to MiroFish /api/report/generate
   → Oracle: stores report content in DB

6. Agent Chat
   → Oracle: calls invokeLLM with agent persona as system prompt
   → Optional: proxies to MiroFish /api/interaction/chat (Zep memory)
```

---

## Environment Variables Required

```env
# Oracle (already configured via Manus platform)
DATABASE_URL=mysql://...
JWT_SECRET=...
BUILT_IN_FORGE_API_KEY=...
BUILT_IN_FORGE_API_URL=...

# MiroFish Python Backend (optional)
MIROFISH_API_URL=http://localhost:5001

# Direct LLM Provider Keys (optional, if not using Forge)
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...

# Zep Cloud (for MiroFish integration)
ZEP_API_KEY=...
```
