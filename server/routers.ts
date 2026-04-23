import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import {
  createProject,
  getProjectsByUser,
  getProjectById,
  updateProject,
  deleteProject,
  getDocumentsByProject,
  getGraphByProject,
  clearGraphForProject,
  upsertGraphNodes,
  upsertGraphEdges,
  getAgentsByProject,
  upsertAgents,
  createSimulationRun,
  getSimulationRunsByProject,
  getSimulationRunById,
  updateSimulationRun,
  getSimulationLogs,
  addSimulationLog,
  createReport,
  getReportsByProject,
  getReportById,
  updateReport,
  addChatMessage,
  getChatMessages,
  getAllUsers,
} from "./db";
import { notifyOwner } from "./_core/notification";
import { completeText, type LLMTask } from "./llm-router";
import {
  createSimulationBranch,
  getBranchesByProject,
  getPredictionsByProject,
  resolvePrediction as resolvePredictionDb,
  createShareLink,
  getShareLinkBySlug,
  bumpShareLinkViews,
  revokeShareLink,
  listShareLinksByProject,
  getGraphEventsByProject,
  listWatchlist,
  createWatchlistItem,
  updateWatchlistItem,
  deleteWatchlistItem,
} from "./db-extensions";
import {
  listPersonaTemplates,
  getPersonaTemplate,
  createPersonaTemplate,
  deletePersonaTemplate,
  applyTemplateToProject,
} from "./persona-library";
import { ingestSymbolNews, ingestWatchlist, recentCatalysts, isFinanceConfigured } from "./finance-ingest";
import { runDeepResearch, isDeepResearchConfigured, checkDeepResearchQuota } from "./deep-research";
import { getMonthlySummary } from "./usage";
import { extractPredictions, persistExtractedPredictions, summarizeCalibration, brierBinary } from "./predictions";
import { renderReportPdf, renderReportPptx } from "./report-export";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

// ─── Admin Procedure ──────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// ─── LLM Router (legacy shim → new task-routed multi-LLM client) ─────────────
// Maps the legacy 4-task signature onto the new LLMTask vocabulary so existing
// call sites keep working while we benefit from per-task model selection
// (Claude Opus 4.7 / Sonnet 4.6 / Haiku 4.5, Gemini 2.5, GPT-5) when keys are set.
async function routeLLM(
  task: "graph_extraction" | "persona_generation" | "report_generation" | "chat",
  prompt: string,
  systemPrompt?: string,
): Promise<string> {
  const mapped: LLMTask = task === "chat" ? "agent_chat" : task;
  try {
    return await completeText(mapped, prompt, systemPrompt);
  } catch (err) {
    console.error(`[LLM] ${task} failed:`, err);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM generation failed" });
  }
}

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Projects ──────────────────────────────────────────────────────────────
  projects: router({
    list: protectedProcedure.query(({ ctx }) => getProjectsByUser(ctx.user.id)),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await getProjectById(input.id);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });
        if (project.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return project;
      }),

    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          description: z.string().optional(),
          topic: z.string().optional(),
          projectType: z.enum(["narrative", "technical", "finance"]).default("narrative"),
          platform: z.enum(["twitter", "reddit", "both"]).optional(),
          agentCount: z.number().min(2).max(100).optional(),
          roundCount: z.number().min(1).max(20).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await createProject({
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
          topic: input.topic,
          projectType: input.projectType,
          platform: input.platform ?? "both",
          agentCount: input.agentCount ?? 10,
          roundCount: input.roundCount ?? 5,
          status: "draft",
        });
        const projects = await getProjectsByUser(ctx.user.id);
        return projects[0];
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          description: z.string().optional(),
          topic: z.string().optional(),
          platform: z.enum(["twitter", "reddit", "both"]).optional(),
          agentCount: z.number().optional(),
          roundCount: z.number().optional(),
          status: z.enum(["draft", "building_graph", "graph_ready", "setting_up", "ready", "running", "completed", "failed"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.id);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });
        if (project.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const { id, ...data } = input;
        await updateProject(id, data);
        return getProjectById(id);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.id);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });
        if (project.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await deleteProject(input.id);
        return { success: true };
      }),
  }),

  // ─── Documents ─────────────────────────────────────────────────────────────
  documents: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(({ input }) => getDocumentsByProject(input.projectId)),
  }),

  // ─── Graph ─────────────────────────────────────────────────────────────────
  graph: router({
    get: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(({ input }) => getGraphByProject(input.projectId)),

    build: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          documentText: z.string().min(10),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await updateProject(input.projectId, { status: "building_graph" });

        const systemPrompt = `You are an expert ontology engineer. Extract a knowledge graph from the provided text.
Return a JSON object with this exact structure:
{
  "nodes": [{"nodeId": "unique_id", "label": "Entity Name", "type": "person|organization|concept|event|location", "description": "brief description"}],
  "edges": [{"sourceId": "node_id", "targetId": "node_id", "label": "relationship type", "weight": 0.8}]
}
Extract 15-30 meaningful entities and their relationships. Be precise and comprehensive.`;

        const rawResponse = await routeLLM(
          "graph_extraction",
          `Extract a knowledge graph from this text:\n\n${input.documentText.slice(0, 8000)}`,
          systemPrompt
        );

        let graphData: { nodes: Array<{ nodeId: string; label: string; type: string; description: string }>; edges: Array<{ sourceId: string; targetId: string; label: string; weight: number }> };

        try {
          const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
          graphData = JSON.parse(jsonMatch ? jsonMatch[0] : rawResponse);
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse graph data from LLM" });
        }

        await clearGraphForProject(input.projectId);

        const nodes = graphData.nodes.map((n) => ({
          projectId: input.projectId,
          nodeId: n.nodeId,
          label: n.label,
          type: n.type || "entity",
          description: n.description,
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          z: (Math.random() - 0.5) * 200,
        }));

        const edges = graphData.edges.map((e) => ({
          projectId: input.projectId,
          sourceId: e.sourceId,
          targetId: e.targetId,
          label: e.label,
          weight: e.weight || 1.0,
        }));

        await upsertGraphNodes(nodes);
        await upsertGraphEdges(edges);
        await updateProject(input.projectId, { status: "graph_ready", graphBuilt: true });

        return { nodes: nodes.length, edges: edges.length };
      }),

    generateAgents: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          topic: z.string(),
          agentCount: z.number().min(2).max(50),
          platform: z.enum(["twitter", "reddit", "both"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await updateProject(input.projectId, { status: "setting_up" });

        const systemPrompt = `You are a social simulation expert. Create realistic agent personas for a multi-agent simulation.
Return a JSON array of agents with this structure:
[{
  "agentId": "agent_001",
  "name": "Full Name",
  "platform": "twitter",
  "persona": "Detailed personality description (2-3 sentences)",
  "ideology": "political/social stance",
  "followers": 1500,
  "following": 800
}]
Create ${input.agentCount} diverse, realistic agents with varied demographics, ideologies, and perspectives on the topic.`;

        const rawResponse = await routeLLM(
          "persona_generation",
          `Create ${input.agentCount} agent personas for a simulation about: "${input.topic}". Platform: ${input.platform}.`,
          systemPrompt
        );

        let agentData: Array<{ agentId: string; name: string; platform: string; persona: string; ideology: string; followers: number; following: number }>;

        try {
          const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
          agentData = JSON.parse(jsonMatch ? jsonMatch[0] : rawResponse);
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse agent data" });
        }

        const agentList = agentData.map((a) => ({
          projectId: input.projectId,
          agentId: a.agentId || `agent_${Math.random().toString(36).slice(2)}`,
          name: a.name,
          platform: (a.platform === "reddit" ? "reddit" : "twitter") as "twitter" | "reddit",
          persona: a.persona,
          ideology: a.ideology,
          followers: a.followers || 0,
          following: a.following || 0,
        }));

        await upsertAgents(agentList);
        await updateProject(input.projectId, { status: "ready", envReady: true });

        return { agentCount: agentList.length };
      }),
  }),

  // ─── Agents ────────────────────────────────────────────────────────────────
  agents: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(({ input }) => getAgentsByProject(input.projectId)),
    chat: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        agentId: z.number().optional(),
        message: z.string().min(1),
        history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).default([]),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });
        const agentsList = await getAgentsByProject(input.projectId);
        let systemPrompt: string;
        let agentName: string;
        if (input.agentId) {
          const agent = agentsList.find((a: any) => a.id === input.agentId);
          if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
          agentName = agent.name as string;
          const agentPersona = (agent as any).persona as string | undefined;
          const agentIdeology = (agent as any).ideology as string | undefined;
          const agentPlatform = (agent as any).platform as string | undefined;
          systemPrompt = `You are ${agentName}, a simulated agent in a multi-agent social simulation about: ${project.topic ?? project.title ?? "this topic"}.\nYour persona: ${agentPersona ?? "A thoughtful participant in the simulation."}\nYour ideology/stance: ${agentIdeology ?? "Balanced and analytical."}\nYour platform: ${agentPlatform ?? "general"}.\nRespond in character as this agent. Be concise, authentic, and insightful.`;
        } else {
          agentName = "Report Agent";
          systemPrompt = `You are the Oracle Report Agent, an expert AI analyst specializing in multi-agent social simulations.\nYou have deep knowledge of the simulation project: ${project.title ?? "this project"}.\nTopic: ${project.topic ?? project.title ?? "this topic"}.\nThere are ${agentsList.length} agents in this simulation.\nProvide insightful, analytical responses about simulation results, trends, agent behaviors, and predictions. Be precise and scholarly.`;
        }
        const historyMessages = input.history.map((h: any) => ({ role: h.role as "user" | "assistant", content: h.content as string }));
        const { complete } = await import("./llm-router");
        const llmResult = await complete({
          task: "agent_chat",
          messages: [
            { role: "system", content: systemPrompt },
            ...historyMessages,
            { role: "user", content: input.message },
          ],
        });
        const reply: string = llmResult.text || "I cannot respond at this time.";
        await addChatMessage({ projectId: input.projectId, userId: ctx.user.id, agentId: input.agentId !== undefined ? String(input.agentId) : undefined, role: "user", content: input.message });
        await addChatMessage({ projectId: input.projectId, userId: ctx.user.id, agentId: input.agentId !== undefined ? String(input.agentId) : undefined, role: "assistant", content: `[${agentName}] ${reply}` });
        return { response: reply, agentName };
      }),
  }),

  // ─── Simulations ───────────────────────────────────────────────────────────
  simulations: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(({ input }) => getSimulationRunsByProject(input.projectId)),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const run = await getSimulationRunById(input.id);
        if (!run) throw new TRPCError({ code: "NOT_FOUND" });
        return run;
      }),

    start: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          totalRounds: z.number().min(1).max(20).default(5),
          platform: z.enum(["twitter", "reddit", "both"]).default("both"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });

        await createSimulationRun({
          projectId: input.projectId,
          userId: ctx.user.id,
          status: "pending",
          totalRounds: input.totalRounds,
          platform: input.platform,
        });

        const runs = await getSimulationRunsByProject(input.projectId);
        const run = runs[0];

        await updateProject(input.projectId, { status: "running" });
        await updateSimulationRun(run.id, { status: "running", startedAt: new Date() });

        // Kick off background simulation
        runSimulationBackground(run.id, input.projectId, input.totalRounds, ctx.user.id).catch(console.error);

        return run;
      }),

    stop: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updateSimulationRun(input.id, { status: "stopped", completedAt: new Date() });
        return { success: true };
      }),

    logs: protectedProcedure
      .input(z.object({ simulationRunId: z.number(), limit: z.number().default(100) }))
      .query(({ input }) => getSimulationLogs(input.simulationRunId, input.limit)),

    // Wipe ALL accumulated agent memories for a project (project owner or admin).
    // Use when you want a true blank-slate re-run, not a memory-informed continuation.
    resetMemory: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });
        if (project.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only the project owner or an admin can reset memory" });
        }
        const { wipeProjectMemories } = await import("./memory");
        const deleted = await wipeProjectMemories(input.projectId);
        return { deleted };
      }),
  }),

  // ─── Reports ───────────────────────────────────────────────────────────────
  reports: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(({ input }) => getReportsByProject(input.projectId)),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const report = await getReportById(input.id);
        if (!report) throw new TRPCError({ code: "NOT_FOUND" });
        return report;
      }),

    generate: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          simulationRunId: z.number().optional(),
          topic: z.string(),
          useDeepResearch: z.boolean().default(false),
          deepResearchVariant: z.enum(["preview", "max"]).default("max"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await createReport({
          projectId: input.projectId,
          simulationRunId: input.simulationRunId,
          userId: ctx.user.id,
          status: "generating",
          title: `Analysis Report: ${input.topic}`,
          metadata: {
            useDeepResearch: input.useDeepResearch,
            deepResearchVariant: input.deepResearchVariant,
          } as Record<string, unknown>,
        });

        const reports = await getReportsByProject(input.projectId);
        const report = reports[0];

        // Background report generation
        generateReportBackground({
          reportId: report.id,
          projectId: input.projectId,
          topic: input.topic,
          userId: ctx.user.id,
          useDeepResearch: input.useDeepResearch,
          deepResearchVariant: input.deepResearchVariant,
        }).catch(console.error);

        return report;
      }),

    // Phase 2.9 — render report to PDF / PPTX, upload to S3, return signed URL.
    exportPdf: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .mutation(async ({ input }) => {
        const report = await getReportById(input.reportId);
        if (!report) throw new TRPCError({ code: "NOT_FOUND" });
        const bytes = await renderReportPdf(report);
        const key = `reports/${report.projectId}/${input.reportId}-${Date.now()}.pdf`;
        const { url } = await storagePut(key, Buffer.from(bytes), "application/pdf");
        await updateReport(input.reportId, { pdfUrl: url, pdfKey: key });
        return { url, key };
      }),

    exportPptx: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .mutation(async ({ input }) => {
        const report = await getReportById(input.reportId);
        if (!report) throw new TRPCError({ code: "NOT_FOUND" });
        const buf = await renderReportPptx(report);
        const key = `reports/${report.projectId}/${input.reportId}-${Date.now()}.pptx`;
        const { url } = await storagePut(key, buf, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
        return { url, key };
      }),
  }),

  // ─── Phase 2.6 — Counterfactual Branches ───────────────────────────────────
  branches: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(({ input }) => getBranchesByProject(input.projectId)),

    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        parentRunId: z.number().optional(),
        label: z.string().min(1).max(120),
        totalRounds: z.number().min(1).max(20).default(5),
        platform: z.enum(["twitter", "reddit", "both"]).default("both"),
        perturbation: z.object({
          ideologyShift: z.string().optional(),
          removeAgentIds: z.array(z.string()).optional(),
          topicReframe: z.string().optional(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });

        await createSimulationRun({
          projectId: input.projectId,
          userId: ctx.user.id,
          status: "pending",
          totalRounds: input.totalRounds,
          platform: input.platform,
        });
        const runs = await getSimulationRunsByProject(input.projectId);
        const newRun = runs[0];

        const branch = await createSimulationBranch({
          projectId: input.projectId,
          parentRunId: input.parentRunId ?? null,
          simulationRunId: newRun.id,
          label: input.label,
          perturbation: input.perturbation,
        });

        await updateSimulationRun(newRun.id, { status: "running", startedAt: new Date() });
        const { runSimulation } = await import("./simulation-runner");
        runSimulation({
          runId: newRun.id,
          projectId: input.projectId,
          totalRounds: input.totalRounds,
          userId: ctx.user.id,
          perturbation: input.perturbation,
        }).catch((err) => console.error("[branch] sim failed:", err));

        return { branch, simulationRunId: newRun.id };
      }),

    compare: protectedProcedure
      .input(z.object({ runIdA: z.number(), runIdB: z.number() }))
      .query(async ({ input }) => {
        const [a, b] = await Promise.all([
          getSimulationLogs(input.runIdA, 200),
          getSimulationLogs(input.runIdB, 200),
        ]);
        const summarize = (logs: typeof a) => {
          const byAgent = new Map<string, number>();
          const byAction = new Map<string, number>();
          for (const l of logs) {
            byAgent.set(l.agentName ?? "?", (byAgent.get(l.agentName ?? "?") ?? 0) + 1);
            byAction.set(l.action ?? "?", (byAction.get(l.action ?? "?") ?? 0) + 1);
          }
          return {
            total: logs.length,
            byAgent: Object.fromEntries(byAgent),
            byAction: Object.fromEntries(byAction),
            sample: logs.slice(0, 10).map((l) => ({ round: l.round, agentName: l.agentName, action: l.action, content: l.content })),
          };
        };
        return { a: summarize(a), b: summarize(b) };
      }),
  }),

  // ─── Phase 2.7 + 2.8 — Predictions & Calibration ────────────────────────────
  predictions: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(({ input }) => getPredictionsByProject(input.projectId)),

    calibration: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(({ input }) => summarizeCalibration(input.projectId)),

    resolve: adminProcedure
      .input(z.object({
        id: z.number(),
        groundTruth: z.string().min(1),
        groundTruthSource: z.string().optional(),
        occurred: z.boolean(),
        confidence: z.number().min(0).max(1),
      }))
      .mutation(async ({ input }) => {
        const brier = brierBinary(input.confidence, input.occurred);
        await resolvePredictionDb(input.id, {
          groundTruth: input.groundTruth,
          groundTruthSource: input.groundTruthSource ?? null,
          brierScore: brier,
        });
        return { brier };
      }),
  }),

  // ─── Phase 2.10 — Public Share Links ────────────────────────────────────────
  share: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(({ input }) => listShareLinksByProject(input.projectId)),

    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        reportId: z.number().optional(),
        scope: z.enum(["report", "project_readonly"]).default("report"),
        expiresInDays: z.number().min(1).max(365).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const slug = nanoid(16);
        const expiresAt = input.expiresInDays
          ? new Date(Date.now() + input.expiresInDays * 86400_000)
          : null;
        const link = await createShareLink({
          projectId: input.projectId,
          reportId: input.reportId ?? null,
          userId: ctx.user.id,
          slug,
          scope: input.scope,
          expiresAt,
        });
        return link;
      }),

    revoke: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await revokeShareLink(input.id);
        return { success: true };
      }),

    // Public — no auth. Used by /share/:slug page and external REST consumers.
    publicGet: publicProcedure
      .input(z.object({ slug: z.string().min(8).max(64) }))
      .query(async ({ input }) => {
        const link = await getShareLinkBySlug(input.slug);
        if (!link) throw new TRPCError({ code: "NOT_FOUND" });
        if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Link expired" });
        }
        await bumpShareLinkViews(link.id);
        const project = await getProjectById(link.projectId);
        const report = link.reportId ? await getReportById(link.reportId) : null;
        return {
          scope: link.scope,
          project: project ? { id: project.id, title: project.title, description: project.description, topic: project.topic } : null,
          report: report ? { id: report.id, title: report.title, summary: report.summary, content: report.content } : null,
        };
      }),
  }),

  // ─── Graph Events feed (live timeline of graph mutations) ──────────────────
  graphEvents: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number(), limit: z.number().default(100) }))
      .query(({ input }) => getGraphEventsByProject(input.projectId, input.limit)),
  }),

  // ─── Persona Library ────────────────────────────────────────────────────────
  personas: router({
    list: protectedProcedure
      .input(z.object({ scope: z.enum(["narrative", "technical", "finance"]).optional() }))
      .query(({ ctx, input }) => listPersonaTemplates({ scope: input.scope, userId: ctx.user.id })),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const t = await getPersonaTemplate(input.id);
        if (!t) throw new TRPCError({ code: "NOT_FOUND" });
        return t;
      }),

    create: protectedProcedure
      .input(z.object({
        scope: z.enum(["narrative", "technical", "finance"]),
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        personas: z.array(z.object({
          name: z.string(),
          persona: z.string(),
          ideology: z.string().optional(),
          platform: z.enum(["twitter", "reddit"]).optional(),
          followers: z.number().optional(),
        })).min(1).max(50),
      }))
      .mutation(({ ctx, input }) => createPersonaTemplate({
        userId: ctx.user.id,
        scope: input.scope,
        name: input.name,
        description: input.description ?? null,
        personas: input.personas,
        isSystem: false,
      })),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deletePersonaTemplate(input.id, ctx.user.id);
        return { success: true };
      }),

    applyToProject: protectedProcedure
      .input(z.object({ templateId: z.number(), projectId: z.number() }))
      .mutation(({ input }) => applyTemplateToProject({ templateId: input.templateId, projectId: input.projectId })),
  }),

  // ─── Watchlist (finance project type) ───────────────────────────────────────
  watchlist: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(({ input }) => listWatchlist(input.projectId)),

    add: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        symbol: z.string().min(1).max(32),
        assetClass: z.enum(["equity", "crypto", "commodity", "forex", "index", "rate"]).default("equity"),
        thesis: z.string().optional(),
        positionSide: z.enum(["long", "short", "watch"]).default("watch"),
      }))
      .mutation(({ ctx, input }) => createWatchlistItem({
        projectId: input.projectId,
        userId: ctx.user.id,
        symbol: input.symbol.toUpperCase(),
        assetClass: input.assetClass,
        thesis: input.thesis ?? null,
        positionSide: input.positionSide,
        ingestSources: ["polygon-news"],
        active: true,
      })),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        thesis: z.string().optional(),
        positionSide: z.enum(["long", "short", "watch"]).optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...rest } = input;
        await updateWatchlistItem(id, rest);
        return { success: true };
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteWatchlistItem(input.id);
        return { success: true };
      }),
  }),

  // ─── Finance ingest + catalysts ─────────────────────────────────────────────
  finance: router({
    isConfigured: publicProcedure.query(() => ({ configured: isFinanceConfigured() })),

    ingest: protectedProcedure
      .input(z.object({ projectId: z.number(), symbol: z.string().optional() }))
      .mutation(async ({ input }) => {
        if (input.symbol) {
          return [await ingestSymbolNews({ projectId: input.projectId, symbol: input.symbol.toUpperCase() })];
        }
        return ingestWatchlist(input.projectId);
      }),

    catalysts: protectedProcedure
      .input(z.object({ projectId: z.number(), limit: z.number().default(50) }))
      .query(({ input }) => recentCatalysts(input.projectId, input.limit)),

    // Trigger a sim from a catalyst — uses the existing simulation runner.
    triggerSim: protectedProcedure
      .input(z.object({ projectId: z.number(), totalRounds: z.number().min(1).max(20).default(4) }))
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });
        await createSimulationRun({
          projectId: input.projectId,
          userId: ctx.user.id,
          status: "pending",
          totalRounds: input.totalRounds,
          platform: project.platform || "both",
        });
        const runs = await getSimulationRunsByProject(input.projectId);
        const run = runs[0];
        await updateSimulationRun(run.id, { status: "running", startedAt: new Date() });
        const { runSimulation } = await import("./simulation-runner");
        runSimulation({ runId: run.id, projectId: input.projectId, totalRounds: input.totalRounds, userId: ctx.user.id }).catch(console.error);
        return run;
      }),
  }),

  // ─── Deep Research (Gemini Apr-2026 preview models) ─────────────────────────
  research: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const configured = isDeepResearchConfigured();
      const quota = configured ? await checkDeepResearchQuota(ctx.user.id) : { usedThisMonth: 0, quota: 0, remaining: 0 };
      return { configured, ...quota };
    }),

    // Phase C: seed a project from a topic — runs deep_research, persists
    // surfaced entities/edges into the knowledge graph, returns suggested agents.
    seedProject: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        topic: z.string().min(3).max(500),
        variant: z.enum(["preview", "max"]).default("preview"),
        suggestedAgentCount: z.number().min(3).max(20).default(8),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });

        const dr = await runDeepResearch({
          variant: input.variant,
          systemInstruction: `You are a research planner for a multi-agent simulation. Surface the key entities, relationships, and stakeholder personas relevant to the topic. Return STRICT JSON with this shape:
{
  "summary": "<2-3 sentence framing of the topic>",
  "entities": [{ "id": "<slug>", "label": "<name>", "type": "<entity_type>", "description": "<one line>" }],
  "relations": [{ "source": "<entity_id>", "target": "<entity_id>", "label": "<relation>" }],
  "personas": [{ "name": "<name>", "persona": "<one-paragraph profile>", "ideology": "<short stance>" }]
}`,
          prompt: `Topic: "${input.topic}"\nProject type: ${project.projectType}\nProduce up to 20 entities, 25 relations, and exactly ${input.suggestedAgentCount} stakeholder personas. Output JSON only.`,
          plan: {
            scope: `Map the entity/persona landscape for "${input.topic}" suitable for a ${project.projectType} multi-agent simulation.`,
            outputStructure: ["JSON object with summary, entities, relations, personas"],
            citationRequirement: "preferred",
            visualizations: false,
          },
          userId: ctx.user.id,
          projectId: input.projectId,
          task: "research_seed",
        });

        // Try to parse JSON out of dr.text
        let parsed: { summary?: string; entities?: Array<{ id: string; label: string; type?: string; description?: string }>; relations?: Array<{ source: string; target: string; label?: string }>; personas?: Array<{ name: string; persona: string; ideology?: string }> } = {};
        try {
          const m = dr.text.match(/\{[\s\S]*\}/);
          parsed = m ? JSON.parse(m[0]) : {};
        } catch (err) {
          console.warn("[research.seedProject] JSON parse failed:", err);
        }

        // Persist nodes
        const nodes = (parsed.entities ?? []).filter((e) => e.id && e.label).map((e) => ({
          projectId: input.projectId,
          nodeId: e.id,
          label: e.label,
          type: e.type ?? "entity",
          description: e.description ?? null,
        }));
        if (nodes.length > 0) await upsertGraphNodes(nodes);

        const edges = (parsed.relations ?? []).filter((r) => r.source && r.target).map((r) => ({
          projectId: input.projectId,
          sourceId: r.source,
          targetId: r.target,
          label: r.label ?? "related_to",
          weight: 1.0,
        }));
        if (edges.length > 0) await upsertGraphEdges(edges);

        // Persist suggested agents
        const personas = parsed.personas ?? [];
        const agentRows = personas.filter((p) => p.name && p.persona).map((p) => ({
          projectId: input.projectId,
          agentId: `${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}-${Date.now().toString(36).slice(-4)}`,
          name: p.name,
          persona: p.persona,
          ideology: p.ideology ?? null,
          platform: "twitter" as const,
          followers: 0,
          following: 0,
        }));
        if (agentRows.length > 0) await upsertAgents(agentRows);

        // Update project as graph-built
        await updateProject(input.projectId, { graphBuilt: true, status: "graph_ready", topic: project.topic ?? input.topic });

        return {
          summary: parsed.summary ?? "",
          entitiesAdded: nodes.length,
          relationsAdded: edges.length,
          agentsAdded: agentRows.length,
          citations: dr.citations,
          model: dr.model,
        };
      }),
  }),

  // ─── Usage (deep-research quota etc.) ───────────────────────────────────────
  usage: router({
    thisMonth: protectedProcedure.query(({ ctx }) => getMonthlySummary(ctx.user.id)),
  }),

  // ─── Chat ──────────────────────────────────────────────────────────────────
  chat: router({
    messages: protectedProcedure
      .input(z.object({ projectId: z.number(), agentId: z.string().optional() }))
      .query(({ input }) => getChatMessages(input.projectId, input.agentId)),

    send: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          agentId: z.string().optional(),
          message: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Save user message
        await addChatMessage({
          projectId: input.projectId,
          userId: ctx.user.id,
          agentId: input.agentId,
          role: "user",
          content: input.message,
        });

        // Get agent context
        const agents = await getAgentsByProject(input.projectId);
        const agent = input.agentId ? agents.find((a) => a.agentId === input.agentId) : null;

        const systemPrompt = agent
          ? `You are ${agent.name}, a social media user with the following persona: ${agent.persona}. Your ideology: ${agent.ideology}. Respond in character, naturally and conversationally.`
          : `You are an AI research assistant analyzing a multi-agent social simulation. Provide insightful, analytical responses about the simulation data and findings.`;

        const history = await getChatMessages(input.projectId, input.agentId);
        const messages = history.slice(-10).map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        }));
        messages.push({ role: "user", content: input.message });

        const response = await routeLLM("chat", input.message, systemPrompt);

        await addChatMessage({
          projectId: input.projectId,
          userId: ctx.user.id,
          agentId: input.agentId,
          role: "assistant",
          content: response,
        });

        return { response };
      }),
  }),

  // ─── Admin ─────────────────────────────────────────────────────────────────
  admin: router({
    users: adminProcedure.query(() => getAllUsers()),
    stats: adminProcedure.query(async () => {
      const users = await getAllUsers();
      return { totalUsers: users.length };
    }),
  }),
});

export type AppRouter = typeof appRouter;

// ─── Background Tasks ─────────────────────────────────────────────────────────
async function runSimulationBackground(runId: number, projectId: number, totalRounds: number, userId: number) {
  // Delegated to the new memory-aware multi-agent runner.
  // Lazy import to avoid circular module load.
  const { runSimulation } = await import("./simulation-runner");
  await runSimulation({ runId, projectId, totalRounds, userId });
}

interface ReportBackgroundArgs {
  reportId: number;
  projectId: number;
  topic: string;
  userId: number;
  useDeepResearch?: boolean;
  deepResearchVariant?: "preview" | "max";
}

async function generateReportBackground(args: ReportBackgroundArgs) {
  const { reportId, projectId, topic, userId, useDeepResearch, deepResearchVariant } = args;
  try {
    const project = await getProjectById(projectId);
    const agents = await getAgentsByProject(projectId);
    const runs = await getSimulationRunsByProject(projectId);
    const latestRun = runs[0];
    const logs = latestRun ? await getSimulationLogs(latestRun.id, 50) : [];

    const systemPrompt = `You are a senior research analyst specializing in social dynamics and AI simulation analysis.
Write a comprehensive, professional analytical report about the simulation findings.
Structure your report with: Executive Summary, Key Findings, Agent Behavior Analysis, Trend Analysis, Predictions, and Recommendations.
Use formal academic language. Be specific and data-driven.`;

    const simulationSummary = logs
      .slice(0, 20)
      .map((l) => `[Round ${l.round}] ${l.agentName} (${l.platform}): ${l.action} - "${l.content?.slice(0, 100)}"`)
      .join("\n");

    const prompt = `Generate a comprehensive analytical report for a multi-agent social simulation.

Topic: ${topic}
Number of Agents: ${agents.length}
Simulation Rounds: ${latestRun?.totalRounds || 5}
Platform: ${project?.platform || "both"}

Agent Ideologies: ${agents.slice(0, 5).map((a) => `${a.name}: ${a.ideology}`).join(", ")}

Sample Simulation Activity:
${simulationSummary || "No simulation data available yet."}

Write a detailed analytical report with insights, patterns, and predictions.`;

    let content = "";
    let visualizations: unknown[] = [];
    let citations: unknown[] = [];
    let provenance: "deep_research" | "standard" = "standard";
    let modelUsed = "";

    if (useDeepResearch) {
      try {
        const { runDeepResearch } = await import("./deep-research");
        const dr = await runDeepResearch({
          variant: deepResearchVariant ?? "max",
          systemInstruction: systemPrompt,
          prompt: `${prompt}\n\nGround your analysis by cross-referencing current public information about the topic. Cite at least 6 sources.`,
          plan: {
            scope: `Synthesize the multi-agent simulation outcome on "${topic}" with current public discourse. Compare in-sim narrative to real-world state.`,
            sources: project?.projectType === "finance"
              ? ["sec.gov", "company filings", "Reuters", "Bloomberg", "FT", "WSJ"]
              : project?.projectType === "technical"
                ? ["arxiv.org", "ieee.org", "manufacturer datasheets", "regulatory bodies"]
                : ["mainstream news", "academic", "regulatory filings"],
            outputStructure: ["Executive Summary", "Key Findings", "Agent Behavior Analysis", "Trend Analysis", "Predictions", "Recommendations"],
            citationRequirement: "required",
            visualizations: true,
            privateContext: [
              { label: "Top simulation activity", content: simulationSummary || "(none)" },
              { label: "Agents", content: agents.slice(0, 12).map((a) => `${a.name} — ${a.ideology ?? ""} — ${a.persona ?? ""}`).join("\n") },
            ],
          },
          userId,
          projectId,
          task: "report_generation",
        });
        content = dr.text;
        visualizations = dr.visualizations;
        citations = dr.citations;
        modelUsed = dr.model;
        provenance = "deep_research";
      } catch (err) {
        console.warn("[Report] Deep Research failed, falling back to standard router:", err);
        content = await routeLLM("report_generation", prompt, systemPrompt);
      }
    } else {
      content = await routeLLM("report_generation", prompt, systemPrompt);
    }

    await updateReport(reportId, {
      content,
      summary: content.slice(0, 500) + "...",
      status: "completed",
      title: `Simulation Analysis Report: ${topic}`,
      metadata: {
        provenance,
        model: modelUsed || undefined,
        visualizations,
        citations,
      } as Record<string, unknown>,
    });

    // Phase 2.7 — extract calibrated predictions from the report and persist
    // them so they can later be resolved against ground truth (Phase 2.8 eval).
    try {
      const extracted = await extractPredictions(content);
      if (extracted.length > 0) {
        await persistExtractedPredictions({
          projectId,
          reportId,
          simulationRunId: latestRun?.id ?? null,
          predictions: extracted,
        });
      }
    } catch (err) {
      console.warn("[Report] prediction extraction skipped:", err);
    }

    await updateProject(projectId, { status: "completed" });

    await notifyOwner({
      title: "Report Generation Complete",
      content: `AI analysis report for "${topic}" (Project #${projectId}) has been generated successfully.`,
    });
  } catch (err) {
    console.error("[Report] Background generation failed:", err);
    await updateReport(reportId, {
      status: "failed",
      content: "Report generation failed. Please try again.",
    });
  }
}
