// Lightweight usage logger and monthly aggregate query.
// Used today by deep-research; ready to plug other premium calls in too.

import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "./db";
import { llmUsage, type InsertLlmUsage } from "../drizzle/schema";

function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function logUsage(entry: Omit<InsertLlmUsage, "monthKey" | "createdAt">): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(llmUsage).values({ ...entry, monthKey: monthKey() });
}

export async function getMonthlyUsage(userId: number, task: string, when = new Date()): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(llmUsage)
    .where(and(eq(llmUsage.userId, userId), eq(llmUsage.task, task), eq(llmUsage.monthKey, monthKey(when))));
  return Number(rows?.[0]?.n ?? 0);
}

export async function getMonthlySummary(userId: number, when = new Date()): Promise<Array<{ task: string; count: number; costUsd: number }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      task: llmUsage.task,
      count: sql<number>`count(*)`,
      cost: sql<number>`coalesce(sum(${llmUsage.costEstimateUsd}), 0)`,
    })
    .from(llmUsage)
    .where(and(eq(llmUsage.userId, userId), eq(llmUsage.monthKey, monthKey(when))))
    .groupBy(llmUsage.task);
  return rows.map((r) => ({ task: r.task, count: Number(r.count), costUsd: Number(r.cost) }));
}
