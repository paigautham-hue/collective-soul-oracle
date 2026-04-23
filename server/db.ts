import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  projects,
  documents,
  graphNodes,
  graphEdges,
  agents,
  simulationRuns,
  simulationLogs,
  reports,
  chatMessages,
  type InsertProject,
  type InsertDocument,
  type InsertSimulationRun,
  type InsertSimulationLog,
  type InsertReport,
  type InsertChatMessage,
  type InsertAgent,
  type InsertGraphNode,
  type InsertGraphEdge,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserProfile(userId: number, data: { avatarUrl?: string; bio?: string; name?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, userId));
}

// ─── Projects ────────────────────────────────────────────────────────────────
export async function createProject(data: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(projects).values(data);
  return result;
}

export async function getProjectsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt));
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result[0];
}

export async function updateProject(id: number, data: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) return;
  await db.update(projects).set(data).where(eq(projects.id, id));
}

export async function deleteProject(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(projects).where(eq(projects.id, id));
}

// ─── Documents ───────────────────────────────────────────────────────────────
export async function createDocument(data: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(documents).values(data);
  return result;
}

export async function getDocumentsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documents).where(eq(documents.projectId, projectId)).orderBy(desc(documents.createdAt));
}

// ─── Graph ────────────────────────────────────────────────────────────────────
export async function upsertGraphNodes(nodes: InsertGraphNode[]) {
  const db = await getDb();
  if (!db) return;
  for (const node of nodes) {
    await db.insert(graphNodes).values(node).onDuplicateKeyUpdate({ set: { label: node.label, description: node.description, properties: node.properties } });
  }
}

export async function upsertGraphEdges(edges: InsertGraphEdge[]) {
  const db = await getDb();
  if (!db) return;
  for (const edge of edges) {
    await db.insert(graphEdges).values(edge);
  }
}

export async function getGraphByProject(projectId: number) {
  const db = await getDb();
  if (!db) return { nodes: [], edges: [] };
  const nodes = await db.select().from(graphNodes).where(eq(graphNodes.projectId, projectId));
  const edges = await db.select().from(graphEdges).where(eq(graphEdges.projectId, projectId));
  return { nodes, edges };
}

export async function clearGraphForProject(projectId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(graphNodes).where(eq(graphNodes.projectId, projectId));
  await db.delete(graphEdges).where(eq(graphEdges.projectId, projectId));
}

// ─── Agents ───────────────────────────────────────────────────────────────────
export async function upsertAgents(agentList: InsertAgent[]) {
  const db = await getDb();
  if (!db) return;
  for (const agent of agentList) {
    await db.insert(agents).values(agent).onDuplicateKeyUpdate({ set: { name: agent.name, persona: agent.persona, properties: agent.properties } });
  }
}

export async function getAgentsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agents).where(eq(agents.projectId, projectId));
}

// ─── Simulation Runs ──────────────────────────────────────────────────────────
export async function createSimulationRun(data: InsertSimulationRun) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(simulationRuns).values(data);
  return result;
}

export async function getSimulationRunsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(simulationRuns).where(eq(simulationRuns.projectId, projectId)).orderBy(desc(simulationRuns.createdAt));
}

export async function getSimulationRunById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(simulationRuns).where(eq(simulationRuns.id, id)).limit(1);
  return result[0];
}

export async function updateSimulationRun(id: number, data: Partial<InsertSimulationRun>) {
  const db = await getDb();
  if (!db) return;
  await db.update(simulationRuns).set(data).where(eq(simulationRuns.id, id));
}

// Hard-delete a simulation run + its logs. Branches that reference it have
// their parentRunId nulled out (we don't cascade-delete branches). Agent
// memories are kept — they're cross-run institutional memory.
export async function deleteSimulationRun(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(simulationLogs).where(eq(simulationLogs.simulationRunId, id));
  await db.delete(simulationRuns).where(eq(simulationRuns.id, id));
}

// ─── Simulation Logs ──────────────────────────────────────────────────────────
export async function addSimulationLog(data: InsertSimulationLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(simulationLogs).values(data);
}

export async function getSimulationLogs(simulationRunId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(simulationLogs)
    .where(eq(simulationLogs.simulationRunId, simulationRunId))
    .orderBy(desc(simulationLogs.createdAt))
    .limit(limit);
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export async function createReport(data: InsertReport) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(reports).values(data);
  return result;
}

export async function getReportsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reports).where(eq(reports.projectId, projectId)).orderBy(desc(reports.createdAt));
}

export async function getReportById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  return result[0];
}

export async function updateReport(id: number, data: Partial<InsertReport>) {
  const db = await getDb();
  if (!db) return;
  await db.update(reports).set(data).where(eq(reports.id, id));
}

// ─── Chat Messages ────────────────────────────────────────────────────────────
export async function addChatMessage(data: InsertChatMessage) {
  const db = await getDb();
  if (!db) return;
  const [result] = await db.insert(chatMessages).values(data);
  return result;
}

export async function getChatMessages(projectId: number, agentId?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = agentId
    ? and(eq(chatMessages.projectId, projectId), eq(chatMessages.agentId, agentId))
    : eq(chatMessages.projectId, projectId);
  return db.select().from(chatMessages).where(conditions).orderBy(chatMessages.createdAt).limit(200);
}
