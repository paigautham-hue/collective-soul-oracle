import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  float,
  boolean,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  avatarUrl: text("avatarUrl"),
  bio: text("bio"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Projects ───────────────────────────────────────────────────────────────
// projectType separates the three workflows so UI/UX doesn't muddle messaging:
//   narrative — original MiroFish-style social / discourse simulation (default)
//   technical — engineering, formulation, design-review, FMEA workflows
//   finance   — stock/commodity catalyst & narrative monitoring
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  projectType: mysqlEnum("projectType", ["narrative", "technical", "finance"]).default("narrative").notNull(),
  status: mysqlEnum("status", [
    "draft",
    "building_graph",
    "graph_ready",
    "setting_up",
    "ready",
    "running",
    "completed",
    "failed",
  ])
    .default("draft")
    .notNull(),
  topic: varchar("topic", { length: 500 }),
  platform: mysqlEnum("platform", ["twitter", "reddit", "both"]).default("both"),
  agentCount: int("agentCount").default(10),
  roundCount: int("roundCount").default(5),
  graphBuilt: boolean("graphBuilt").default(false),
  envReady: boolean("envReady").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ─── Documents ──────────────────────────────────────────────────────────────
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  filename: varchar("filename", { length: 500 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  storageKey: text("storageKey").notNull(),
  storageUrl: text("storageUrl").notNull(),
  sizeBytes: int("sizeBytes"),
  extractedText: text("extractedText"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// ─── Graph Nodes ─────────────────────────────────────────────────────────────
export const graphNodes = mysqlTable("graph_nodes", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  nodeId: varchar("nodeId", { length: 255 }).notNull(),
  label: varchar("label", { length: 500 }).notNull(),
  type: varchar("type", { length: 100 }).default("entity"),
  description: text("description"),
  properties: json("properties"),
  x: float("x"),
  y: float("y"),
  z: float("z"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GraphNode = typeof graphNodes.$inferSelect;
export type InsertGraphNode = typeof graphNodes.$inferInsert;

// ─── Graph Edges ─────────────────────────────────────────────────────────────
export const graphEdges = mysqlTable("graph_edges", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  sourceId: varchar("sourceId", { length: 255 }).notNull(),
  targetId: varchar("targetId", { length: 255 }).notNull(),
  label: varchar("label", { length: 255 }),
  weight: float("weight").default(1.0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GraphEdge = typeof graphEdges.$inferSelect;
export type InsertGraphEdge = typeof graphEdges.$inferInsert;

// ─── Agents ──────────────────────────────────────────────────────────────────
export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  agentId: varchar("agentId", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  persona: text("persona"),
  platform: mysqlEnum("platform", ["twitter", "reddit"]).default("twitter"),
  followers: int("followers").default(0),
  following: int("following").default(0),
  ideology: varchar("ideology", { length: 255 }),
  properties: json("properties"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;

// ─── Simulation Runs ─────────────────────────────────────────────────────────
export const simulationRuns = mysqlTable("simulation_runs", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", [
    "pending",
    "running",
    "completed",
    "failed",
    "stopped",
  ])
    .default("pending")
    .notNull(),
  currentRound: int("currentRound").default(0),
  totalRounds: int("totalRounds").default(5),
  platform: mysqlEnum("platform", ["twitter", "reddit", "both"]).default("both"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SimulationRun = typeof simulationRuns.$inferSelect;
export type InsertSimulationRun = typeof simulationRuns.$inferInsert;

// ─── Simulation Logs ─────────────────────────────────────────────────────────
export const simulationLogs = mysqlTable("simulation_logs", {
  id: int("id").autoincrement().primaryKey(),
  simulationRunId: int("simulationRunId").notNull(),
  projectId: int("projectId").notNull(),
  round: int("round").default(0),
  agentName: varchar("agentName", { length: 255 }),
  platform: varchar("platform", { length: 50 }),
  action: varchar("action", { length: 100 }),
  content: text("content"),
  logLevel: mysqlEnum("logLevel", ["info", "warn", "error", "debug"]).default("info"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SimulationLog = typeof simulationLogs.$inferSelect;
export type InsertSimulationLog = typeof simulationLogs.$inferInsert;

// ─── Reports ─────────────────────────────────────────────────────────────────
export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  simulationRunId: int("simulationRunId"),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 500 }),
  content: text("content"),
  summary: text("summary"),
  status: mysqlEnum("status", ["pending", "generating", "completed", "failed"])
    .default("pending")
    .notNull(),
  pdfUrl: text("pdfUrl"),
  pdfKey: text("pdfKey"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

// ─── Chat Messages ────────────────────────────────────────────────────────────
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  agentId: varchar("agentId", { length: 255 }),
  role: mysqlEnum("role", ["user", "assistant", "system"]).default("user").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// ─── Agent Memories ──────────────────────────────────────────────────────────
// Vector memory layer. `embedding` is a JSON-encoded float[] (length = model dim,
// e.g. 1536 for OpenAI text-embedding-3-small). Cosine similarity computed in JS
// at retrieval time. `salience` decays over rounds; consolidation prunes low-salience.
export const agentMemories = mysqlTable("agent_memories", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  agentId: varchar("agentId", { length: 255 }).notNull(),
  simulationRunId: int("simulationRunId"),
  round: int("round").default(0),
  kind: mysqlEnum("kind", ["observation", "action", "reflection", "fact"]).default("observation").notNull(),
  content: text("content").notNull(),
  embedding: json("embedding").$type<number[]>(),
  salience: float("salience").default(1.0).notNull(),
  decayedAt: timestamp("decayedAt"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentMemory = typeof agentMemories.$inferSelect;
export type InsertAgentMemory = typeof agentMemories.$inferInsert;

// ─── Graph Events ────────────────────────────────────────────────────────────
// Records when simulation activity creates/modifies graph nodes & edges so the
// knowledge graph evolves alongside the simulation.
export const graphEvents = mysqlTable("graph_events", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  simulationRunId: int("simulationRunId"),
  round: int("round").default(0),
  eventType: mysqlEnum("eventType", ["node_added", "node_updated", "edge_added", "edge_strengthened", "edge_weakened"]).notNull(),
  refNodeId: varchar("refNodeId", { length: 255 }),
  refEdgeFrom: varchar("refEdgeFrom", { length: 255 }),
  refEdgeTo: varchar("refEdgeTo", { length: 255 }),
  delta: json("delta"),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GraphEvent = typeof graphEvents.$inferSelect;
export type InsertGraphEvent = typeof graphEvents.$inferInsert;

// ─── Simulation Branches (Phase 2: counterfactuals) ──────────────────────────
// A branch is a parallel sim variant on the same project with a perturbation
// (e.g. shifted ideology distribution, removed agent, alt topic framing).
export const simulationBranches = mysqlTable("simulation_branches", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  parentRunId: int("parentRunId"),
  simulationRunId: int("simulationRunId").notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  perturbation: json("perturbation"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SimulationBranch = typeof simulationBranches.$inferSelect;
export type InsertSimulationBranch = typeof simulationBranches.$inferInsert;

// ─── Predictions + Calibration (Phase 2: confidence/eval) ────────────────────
export const predictions = mysqlTable("predictions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  simulationRunId: int("simulationRunId"),
  reportId: int("reportId"),
  claim: text("claim").notNull(),
  predictedOutcome: text("predictedOutcome").notNull(),
  confidence: float("confidence").notNull(),
  confidenceBandLow: float("confidenceBandLow"),
  confidenceBandHigh: float("confidenceBandHigh"),
  horizonDays: int("horizonDays"),
  resolutionDate: timestamp("resolutionDate"),
  groundTruth: text("groundTruth"),
  groundTruthSource: text("groundTruthSource"),
  brierScore: float("brierScore"),
  resolvedAt: timestamp("resolvedAt"),
  // External market benchmark (Polymarket / Kalshi / etc.) for calibration context.
  externalSource: varchar("externalSource", { length: 64 }),       // 'polymarket', 'kalshi', 'manifold'
  externalRef: varchar("externalRef", { length: 255 }),            // slug / market id
  externalProbability: float("externalProbability"),               // 0..1 implied prob at last check
  externalLastCheckedAt: timestamp("externalLastCheckedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Prediction = typeof predictions.$inferSelect;
export type InsertPrediction = typeof predictions.$inferInsert;

// ─── Share Links (Phase 2: public sharing) ───────────────────────────────────
// ─── Persona Templates ──────────────────────────────────────────────────────
// Reusable expert persona packs. Curated seed packs cover narrative / technical /
// finance domains; users can also save their own. Applying a pack to a project
// upserts agents from the template's persona list.
export const personaTemplates = mysqlTable("persona_templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),                                      // null = global / system seed
  scope: mysqlEnum("scope", ["narrative", "technical", "finance"]).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  personas: json("personas").$type<Array<{
    name: string;
    persona: string;
    ideology?: string;
    platform?: "twitter" | "reddit";
    followers?: number;
  }>>().notNull(),
  isSystem: boolean("isSystem").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PersonaTemplate = typeof personaTemplates.$inferSelect;
export type InsertPersonaTemplate = typeof personaTemplates.$inferInsert;

// ─── Watchlist (finance project type) ────────────────────────────────────────
export const watchlistItems = mysqlTable("watchlist_items", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  symbol: varchar("symbol", { length: 128 }).notNull(),        // 'AAPL', 'NVDA', 'BTC-USD', 'CL=F', or polymarket slug
  assetClass: mysqlEnum("assetClass", ["equity", "crypto", "commodity", "forex", "index", "rate", "prediction_market"]).default("equity").notNull(),
  thesis: text("thesis"),                                       // your reason for tracking
  positionSide: mysqlEnum("positionSide", ["long", "short", "watch"]).default("watch"),
  ingestSources: json("ingestSources").$type<string[]>(),      // ['polygon-news', 'sec-edgar', 'reddit-wsb']
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WatchlistItem = typeof watchlistItems.$inferSelect;
export type InsertWatchlistItem = typeof watchlistItems.$inferInsert;

// ─── Catalyst Events (auto-detected, can trigger sims) ──────────────────────
export const catalystEvents = mysqlTable("catalyst_events", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  watchlistItemId: int("watchlistItemId"),
  symbol: varchar("symbol", { length: 32 }),
  source: varchar("source", { length: 64 }).notNull(),         // 'polygon-news', 'sec-edgar', 'manual'
  externalId: varchar("externalId", { length: 255 }),          // dedup key from source
  headline: text("headline").notNull(),
  summary: text("summary"),
  url: text("url"),
  sentiment: mysqlEnum("sentiment", ["bullish", "bearish", "neutral", "mixed"]),
  importance: int("importance").default(50),                    // 0-100
  publishedAt: timestamp("publishedAt"),
  triggeredSimId: int("triggeredSimId"),                        // link to sim spawned by this event
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CatalystEvent = typeof catalystEvents.$inferSelect;
export type InsertCatalystEvent = typeof catalystEvents.$inferInsert;

// ─── LLM Usage (cost & quota tracking for premium calls e.g. deep-research) ─
export const llmUsage = mysqlTable("llm_usage", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  task: varchar("task", { length: 64 }).notNull(),
  provider: varchar("provider", { length: 32 }),
  model: varchar("model", { length: 128 }),
  monthKey: varchar("monthKey", { length: 7 }).notNull(),    // 'YYYY-MM' for fast monthly aggregates
  callMs: int("callMs"),
  inputTokens: int("inputTokens"),
  outputTokens: int("outputTokens"),
  costEstimateUsd: float("costEstimateUsd"),
  status: mysqlEnum("status", ["ok", "error", "throttled"]).default("ok"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LlmUsage = typeof llmUsage.$inferSelect;
export type InsertLlmUsage = typeof llmUsage.$inferInsert;

// ─── Reports — extend with deep-research metadata ────────────────────────────
// (existing reports table is reused; we just store visualizations + flags
//  in the existing JSON `metadata` column — no schema change needed)

export const shareLinks = mysqlTable("share_links", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  reportId: int("reportId"),
  userId: int("userId").notNull(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  scope: mysqlEnum("scope", ["report", "project_readonly"]).default("report").notNull(),
  expiresAt: timestamp("expiresAt"),
  views: int("views").default(0).notNull(),
  revoked: boolean("revoked").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShareLink = typeof shareLinks.$inferSelect;
export type InsertShareLink = typeof shareLinks.$inferInsert;
