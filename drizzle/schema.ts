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
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
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
