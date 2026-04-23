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
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";

// ─── Admin Procedure ──────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// ─── LLM Router (server-side only) ───────────────────────────────────────────
async function routeLLM(task: "graph_extraction" | "persona_generation" | "report_generation" | "chat", prompt: string, systemPrompt?: string) {
  const messages: { role: "system" | "user"; content: string }[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  try {
    const response = await invokeLLM({ messages });
    const content = response?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty LLM response");
    return content as string;
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
        const llmMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
          { role: "system", content: systemPrompt },
          ...historyMessages,
          { role: "user", content: input.message },
        ];
        const llmResponse = await invokeLLM({ messages: llmMessages });
        const rawReply = llmResponse?.choices?.[0]?.message?.content;
        const reply: string = typeof rawReply === "string" ? rawReply : "I cannot respond at this time.";
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
        })
      )
      .mutation(async ({ ctx, input }) => {
        await createReport({
          projectId: input.projectId,
          simulationRunId: input.simulationRunId,
          userId: ctx.user.id,
          status: "generating",
          title: `Analysis Report: ${input.topic}`,
        });

        const reports = await getReportsByProject(input.projectId);
        const report = reports[0];

        // Background report generation
        generateReportBackground(report.id, input.projectId, input.topic, ctx.user.id).catch(console.error);

        return report;
      }),
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
  try {
    const agents = await getAgentsByProject(projectId);
    const project = await getProjectById(projectId);

    for (let round = 1; round <= totalRounds; round++) {
      await updateSimulationRun(runId, { currentRound: round });

      // Simulate agent actions for this round
      for (const agent of agents.slice(0, Math.min(agents.length, 5))) {
        const action = ["posted", "retweeted", "replied", "liked", "shared"][Math.floor(Math.random() * 5)];
        const platforms = ["twitter", "reddit"];
        const platform = platforms[Math.floor(Math.random() * platforms.length)];

        const content = await routeLLM(
          "chat",
          `As ${agent.name} (${agent.persona}), write a short social media ${action} about: "${project?.topic || "the current topic"}". Keep it under 280 characters.`,
        ).catch(() => `[${agent.name}] ${action} about the topic.`);

        await addSimulationLog({
          simulationRunId: runId,
          projectId,
          round,
          agentName: agent.name,
          platform,
          action,
          content,
          logLevel: "info",
        });

        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 500));
      }

      await new Promise((r) => setTimeout(r, 1000));
    }

    await updateSimulationRun(runId, { status: "completed", completedAt: new Date() });
    await updateProject(projectId, { status: "completed" });

    await notifyOwner({
      title: "Simulation Completed",
      content: `Simulation run #${runId} for project #${projectId} has completed successfully after ${totalRounds} rounds.`,
    });
  } catch (err) {
    console.error("[Simulation] Background task failed:", err);
    await updateSimulationRun(runId, {
      status: "failed",
      errorMessage: err instanceof Error ? err.message : "Unknown error",
      completedAt: new Date(),
    });
    await updateProject(projectId, { status: "failed" });
  }
}

async function generateReportBackground(reportId: number, projectId: number, topic: string, userId: number) {
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

    const content = await routeLLM("report_generation", prompt, systemPrompt);

    await updateReport(reportId, {
      content,
      summary: content.slice(0, 500) + "...",
      status: "completed",
      title: `Simulation Analysis Report: ${topic}`,
    });

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
