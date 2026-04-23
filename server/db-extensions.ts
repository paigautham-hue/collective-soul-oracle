// Helpers for the new tables added in the 5x-mirofish migration.
// Kept in a separate file from server/db.ts to avoid bloating that module.

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import {
  graphEvents,
  type InsertGraphEvent,
  type GraphEvent,
  simulationBranches,
  type InsertSimulationBranch,
  type SimulationBranch,
  predictions,
  type InsertPrediction,
  type Prediction,
  shareLinks,
  type InsertShareLink,
  type ShareLink,
  watchlistItems,
  type InsertWatchlistItem,
  type WatchlistItem,
} from "../drizzle/schema";

// ─── Graph Events ─────────────────────────────────────────────────────────────
export async function addGraphEvent(data: InsertGraphEvent): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(graphEvents).values(data);
}

export async function getGraphEventsByProject(projectId: number, limit = 200): Promise<GraphEvent[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(graphEvents)
    .where(eq(graphEvents.projectId, projectId))
    .orderBy(desc(graphEvents.createdAt))
    .limit(limit);
}

// ─── Simulation Branches ──────────────────────────────────────────────────────
export async function createSimulationBranch(data: InsertSimulationBranch): Promise<SimulationBranch | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(simulationBranches).values(data);
  const insertedId = (result as unknown as { insertId: number }).insertId;
  const [created] = await db.select().from(simulationBranches).where(eq(simulationBranches.id, insertedId)).limit(1);
  return created ?? null;
}

export async function getBranchesByProject(projectId: number): Promise<SimulationBranch[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(simulationBranches).where(eq(simulationBranches.projectId, projectId)).orderBy(desc(simulationBranches.createdAt));
}

// ─── Predictions ──────────────────────────────────────────────────────────────
export async function createPrediction(data: InsertPrediction): Promise<Prediction | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(predictions).values(data);
  const insertedId = (result as unknown as { insertId: number }).insertId;
  const [created] = await db.select().from(predictions).where(eq(predictions.id, insertedId)).limit(1);
  return created ?? null;
}

export async function getPredictionsByProject(projectId: number): Promise<Prediction[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(predictions).where(eq(predictions.projectId, projectId)).orderBy(desc(predictions.createdAt));
}

export async function resolvePrediction(id: number, args: { groundTruth: string; groundTruthSource?: string | null; brierScore?: number | null }): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(predictions).set({
    groundTruth: args.groundTruth,
    groundTruthSource: args.groundTruthSource ?? null,
    brierScore: args.brierScore ?? null,
    resolvedAt: new Date(),
  }).where(eq(predictions.id, id));
}

export async function getUnresolvedPredictions(limit = 100): Promise<Prediction[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(predictions)
    .where(eq(predictions.resolvedAt as unknown as never, null as unknown as never))
    .limit(limit);
}

// ─── Share Links ──────────────────────────────────────────────────────────────
export async function createShareLink(data: InsertShareLink): Promise<ShareLink | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(shareLinks).values(data);
  const insertedId = (result as unknown as { insertId: number }).insertId;
  const [created] = await db.select().from(shareLinks).where(eq(shareLinks.id, insertedId)).limit(1);
  return created ?? null;
}

export async function getShareLinkBySlug(slug: string): Promise<ShareLink | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(shareLinks).where(and(eq(shareLinks.slug, slug), eq(shareLinks.revoked, false))).limit(1);
  return row ?? null;
}

export async function bumpShareLinkViews(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const [row] = await db.select().from(shareLinks).where(eq(shareLinks.id, id)).limit(1);
  if (!row) return;
  await db.update(shareLinks).set({ views: (row.views ?? 0) + 1 }).where(eq(shareLinks.id, id));
}

export async function revokeShareLink(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(shareLinks).set({ revoked: true }).where(eq(shareLinks.id, id));
}

export async function listShareLinksByProject(projectId: number): Promise<ShareLink[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareLinks).where(eq(shareLinks.projectId, projectId)).orderBy(desc(shareLinks.createdAt));
}

// ─── Watchlist ────────────────────────────────────────────────────────────────
export async function listWatchlist(projectId: number): Promise<WatchlistItem[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(watchlistItems).where(eq(watchlistItems.projectId, projectId)).orderBy(desc(watchlistItems.createdAt));
}

export async function createWatchlistItem(data: InsertWatchlistItem): Promise<WatchlistItem | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(watchlistItems).values(data);
  const id = (result as unknown as { insertId: number }).insertId;
  const [created] = await db.select().from(watchlistItems).where(eq(watchlistItems.id, id)).limit(1);
  return created ?? null;
}

export async function updateWatchlistItem(id: number, data: Partial<InsertWatchlistItem>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(watchlistItems).set(data).where(eq(watchlistItems.id, id));
}

export async function deleteWatchlistItem(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(watchlistItems).where(eq(watchlistItems.id, id));
}
