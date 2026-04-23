import { getDb } from "./db";
import { agentMemories, type AgentMemory, type InsertAgentMemory } from "../drizzle/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { embedOne, cosine } from "./embeddings";

export type MemoryKind = "observation" | "action" | "reflection" | "fact";

export interface RememberInput {
  projectId: number;
  agentId: string;
  simulationRunId?: number | null;
  round?: number | null;
  kind?: MemoryKind;
  content: string;
  salience?: number;
  metadata?: Record<string, unknown> | null;
  skipEmbedding?: boolean;
}

export async function remember(input: RememberInput): Promise<AgentMemory | null> {
  const db = await getDb();
  if (!db) return null;
  const embedding = input.skipEmbedding ? null : await embedOne(input.content);
  const row: InsertAgentMemory = {
    projectId: input.projectId,
    agentId: input.agentId,
    simulationRunId: input.simulationRunId ?? null,
    round: input.round ?? 0,
    kind: input.kind ?? "observation",
    content: input.content,
    embedding: embedding,
    salience: input.salience ?? 1.0,
    metadata: input.metadata ?? null,
  };
  const result = await db.insert(agentMemories).values(row);
  const insertedId = (result as unknown as { insertId: number }).insertId;
  const [created] = await db.select().from(agentMemories).where(eq(agentMemories.id, insertedId)).limit(1);
  return created ?? null;
}

export interface RecallOptions {
  projectId: number;
  agentId: string;
  query: string;
  k?: number;
  kinds?: MemoryKind[];
  minSalience?: number;
  // Recency boost weight (0..1). 0.3 = 30% recency, 70% similarity.
  recencyWeight?: number;
}

export async function recall(opts: RecallOptions): Promise<Array<AgentMemory & { score: number }>> {
  const db = await getDb();
  if (!db) return [];
  const k = opts.k ?? 6;
  const recencyWeight = opts.recencyWeight ?? 0.2;
  const minSalience = opts.minSalience ?? 0.05;

  const conditions = [
    eq(agentMemories.projectId, opts.projectId),
    eq(agentMemories.agentId, opts.agentId),
    sql`${agentMemories.salience} >= ${minSalience}`,
  ];

  // Cap candidate set; cosine in JS is fine at this scale.
  const candidates = await db
    .select()
    .from(agentMemories)
    .where(and(...conditions))
    .orderBy(desc(agentMemories.createdAt))
    .limit(200);

  if (candidates.length === 0) return [];

  const filtered = opts.kinds && opts.kinds.length > 0
    ? candidates.filter((c) => opts.kinds!.includes(c.kind as MemoryKind))
    : candidates;

  const queryVec = await embedOne(opts.query);
  const now = Date.now();
  const horizonMs = 1000 * 60 * 60 * 24 * 7; // 7-day half-life for recency

  const scored = filtered.map((m) => {
    const sim = m.embedding ? cosine(queryVec, m.embedding) : 0;
    const ageMs = now - new Date(m.createdAt).getTime();
    const recency = Math.exp(-ageMs / horizonMs);
    const score = (1 - recencyWeight) * sim + recencyWeight * recency;
    return { ...m, score: score * (m.salience ?? 1) };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

// Decay all memories for a project — call at end of each round.
export async function decayMemories(projectId: number, factor = 0.92): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(agentMemories)
    .set({ salience: sql`${agentMemories.salience} * ${factor}` })
    .where(eq(agentMemories.projectId, projectId));
}

// Periodically delete near-zero memories to keep table small.
export async function consolidate(projectId: number, threshold = 0.02): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .delete(agentMemories)
    .where(and(eq(agentMemories.projectId, projectId), sql`${agentMemories.salience} < ${threshold}`));
  return (result as unknown as { affectedRows?: number }).affectedRows ?? 0;
}
