// Multi-agent simulation runner with persistent memory + live streaming +
// dynamic graph enrichment. Replaces the naive random-action loop.
//
// Per round, for each agent (parallelized in batches):
//   1. Observe — read peers' last-round actions
//   2. Recall — vector-retrieve relevant memories of own + peer actions
//   3. Decide — LLM call (agent_action task → Claude Haiku 4.5 / Gemini 2.5 Flash)
//      that returns { action, content, ?newEntity, ?newRelation, ?reflection }
//   4. Log + Remember — persist action, write memory, emit socket event
//   5. Enrich graph — if LLM proposed a new entity/relation, write graph_event
// At the end of each round: light salience decay + every 3 rounds reflection pass.

import {
  getAgentsByProject,
  getProjectById,
  updateSimulationRun,
  updateProject,
  addSimulationLog,
  getSimulationLogs,
  upsertGraphNodes,
  upsertGraphEdges,
} from "./db";
import { complete } from "./llm-router";
import { remember, recall, decayMemories } from "./memory";
import { addGraphEvent } from "./db-extensions";
import { emitSimulationLog, emitSimulationStatus, emitGraphEvent } from "./uploadAndSocket";
import { notifyOwner } from "./_core/notification";
import { executeTool, toolsAvailableFor, describeToolsForPrompt, type ToolName, type ToolCall } from "./agent-tools";

const PLATFORM_CHOICES = ["twitter", "reddit"] as const;
const VALID_ACTIONS = ["posted", "retweeted", "replied", "liked", "shared", "observed"] as const;
type ValidAction = (typeof VALID_ACTIONS)[number];

interface AgentDecision {
  action: ValidAction;
  content: string;
  reasoning?: string;
  newEntity?: { id: string; label: string; type?: string; description?: string };
  newRelation?: { source: string; target: string; label?: string };
  toolCall?: ToolCall;
}

const DECISION_SCHEMA = {
  name: "AgentDecision",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["action", "content"],
    properties: {
      action: { type: "string", enum: [...VALID_ACTIONS] },
      content: { type: "string", maxLength: 600 },
      reasoning: { type: "string", maxLength: 300 },
      newEntity: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          type: { type: "string" },
          description: { type: "string" },
        },
        required: ["id", "label"],
      },
      newRelation: {
        type: "object",
        properties: {
          source: { type: "string" },
          target: { type: "string" },
          label: { type: "string" },
        },
        required: ["source", "target"],
      },
      toolCall: {
        type: "object",
        properties: {
          tool: { type: "string" },
          args: { type: "object" },
        },
        required: ["tool", "args"],
      },
    },
  },
  strict: false,
} as const;

function buildAgentSystemPrompt(agent: {
  name: string;
  persona?: string | null;
  ideology?: string | null;
  platform?: string | null;
}, topic: string, projectType: "narrative" | "technical" | "finance", toolNames: ToolName[]) {
  const flavour = projectType === "technical"
    ? `multi-disciplinary technical design review on: "${topic}". Be specific, cite trade-offs, name risks.`
    : projectType === "finance"
      ? `event-driven finance round-table on: "${topic}". Focus on narrative shifts, catalyst impact, risk framing — NOT direct price prediction.`
      : `multi-agent social simulation about: "${topic}".`;

  const lines = [
    `You are ${agent.name}, a simulated expert in a ${flavour}`,
    `Persona: ${agent.persona ?? "A thoughtful participant."}`,
    `Ideology / stance: ${agent.ideology ?? "balanced and analytical"}.`,
    projectType === "narrative" ? `Primary platform: ${agent.platform ?? "general"}.` : "",
    `You react authentically to peer activity and your own memories.`,
    `Always respond with valid JSON matching the AgentDecision schema.`,
    projectType === "narrative"
      ? `Keep "content" under 280 chars when possible.`
      : `"content" should be a substantive contribution (1-3 sentences). Be concrete, not generic.`,
    `Use "newEntity" / "newRelation" sparingly — only when this round genuinely surfaces a new actor, concept, or relationship.`,
  ].filter(Boolean);
  const toolBlock = describeToolsForPrompt(toolNames);
  if (toolBlock) lines.push("", toolBlock);
  return lines.join("\n");
}

function summarizePeers(peerActions: Array<{ agentName: string | null; action: string | null; content: string | null }>) {
  if (peerActions.length === 0) return "(no peer activity yet — this is the opening round)";
  return peerActions
    .slice(-12)
    .map((p) => `- ${p.agentName ?? "?"} ${p.action ?? "acted"}: ${(p.content ?? "").slice(0, 160)}`)
    .join("\n");
}

function summarizeMemories(memories: Array<{ kind: string; content: string; round: number | null }>) {
  if (memories.length === 0) return "(no relevant memories yet)";
  return memories
    .map((m) => `- [r${m.round ?? 0} ${m.kind}] ${m.content.slice(0, 200)}`)
    .join("\n");
}

async function decideAgentAction(args: {
  agent: { id: number; agentId: string; name: string; persona?: string | null; ideology?: string | null; platform?: string | null };
  topic: string;
  round: number;
  projectType: "narrative" | "technical" | "finance";
  toolNames: ToolName[];
  toolResultForLastTool?: string;
  peerActions: Array<{ agentName: string | null; action: string | null; content: string | null }>;
  memories: Array<{ kind: string; content: string; round: number | null }>;
}): Promise<AgentDecision> {
  const { agent, topic, round, projectType, toolNames, toolResultForLastTool, peerActions, memories } = args;
  const systemPrompt = buildAgentSystemPrompt(agent, topic, projectType, toolNames);
  const promptLines = [
    `ROUND ${round}.`,
    ``,
    `Recent peer activity:`,
    summarizePeers(peerActions),
    ``,
    `Your relevant memories (most-salient first):`,
    summarizeMemories(memories),
  ];
  if (toolResultForLastTool) {
    promptLines.push(``, `Result of your previous tool call:`, toolResultForLastTool);
  }
  promptLines.push(``, `Decide your next action. Respond ONLY as JSON matching AgentDecision.`);
  const userPrompt = promptLines.join("\n");

  try {
    const result = await complete({
      task: "agent_action",
      systemPrompt,
      prompt: userPrompt,
      responseFormat: "json",
      jsonSchema: DECISION_SCHEMA,
      maxTokens: 800,
    });
    const parsed = (result.json ?? safeParseJson(result.text)) as Partial<AgentDecision> | undefined;
    if (parsed && typeof parsed === "object" && parsed.action && parsed.content) {
      const action = (VALID_ACTIONS as readonly string[]).includes(parsed.action) ? (parsed.action as ValidAction) : "posted";
      return {
        action,
        content: String(parsed.content).slice(0, 600),
        reasoning: parsed.reasoning ? String(parsed.reasoning).slice(0, 300) : undefined,
        newEntity: parsed.newEntity,
        newRelation: parsed.newRelation,
      };
    }
  } catch (err) {
    console.warn(`[sim] decision LLM failed for ${agent.name}:`, err);
  }
  // Fallback: minimal observation
  return { action: "observed", content: `${agent.name} considered the discussion this round.` };
}

function safeParseJson(s: string): unknown {
  try { return JSON.parse(s); } catch { /* try block */ }
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  return undefined;
}

async function reflectAgent(args: {
  agent: { id: number; agentId: string; name: string };
  projectId: number;
  simulationRunId: number;
  round: number;
  ownActions: Array<{ round: number | null; content: string | null; action: string | null }>;
}): Promise<void> {
  if (args.ownActions.length === 0) return;
  const summary = args.ownActions
    .slice(-8)
    .map((a) => `r${a.round ?? 0} ${a.action ?? "acted"}: ${(a.content ?? "").slice(0, 200)}`)
    .join("\n");
  try {
    const r = await complete({
      task: "reflection",
      systemPrompt: `You are ${args.agent.name}. Reflect briefly on your recent activity. Output 1-2 sentences capturing what you've come to believe about the topic, not a chronological recap.`,
      prompt: `My recent actions:\n${summary}\n\nOne short reflection:`,
      maxTokens: 200,
    });
    const text = r.text.trim();
    if (text) {
      await remember({
        projectId: args.projectId,
        agentId: args.agent.agentId,
        simulationRunId: args.simulationRunId,
        round: args.round,
        kind: "reflection",
        content: text,
        salience: 1.4,
      });
    }
  } catch (err) {
    console.warn(`[sim] reflection failed for ${args.agent.name}:`, err);
  }
}

export interface RunSimulationOptions {
  runId: number;
  projectId: number;
  totalRounds: number;
  userId: number;
  perturbation?: { ideologyShift?: string; removeAgentIds?: string[]; topicReframe?: string };
}

export async function runSimulation(opts: RunSimulationOptions): Promise<void> {
  const { runId, projectId, totalRounds, perturbation } = opts;
  try {
    const project = await getProjectById(projectId);
    let agents = await getAgentsByProject(projectId);
    if (perturbation?.removeAgentIds?.length) {
      agents = agents.filter((a) => !perturbation.removeAgentIds!.includes(a.agentId));
    }
    const baseTopic = project?.topic ?? project?.title ?? "the topic";
    const topic = perturbation?.topicReframe ? `${baseTopic} (reframed: ${perturbation.topicReframe})` : baseTopic;
    const projectType = (project?.projectType ?? "narrative") as "narrative" | "technical" | "finance";
    const toolNames = toolsAvailableFor(projectType);

    emitSimulationStatus(runId, "running", 0, totalRounds);

    for (let round = 1; round <= totalRounds; round++) {
      await updateSimulationRun(runId, { currentRound: round });
      emitSimulationStatus(runId, "running", round, totalRounds);

      // Pull last 30 actions of all agents — peer awareness window.
      const recentLogs = await getSimulationLogs(runId, 30);
      const peerActions = recentLogs.map((l) => ({
        agentName: l.agentName,
        action: l.action,
        content: l.content,
      }));

      // Process agents in batches of 3 to limit LLM concurrency.
      for (let i = 0; i < agents.length; i += 3) {
        const batch = agents.slice(i, i + 3);
        await Promise.all(batch.map((agent) => stepAgent({
          agent,
          topic,
          round,
          runId,
          projectId,
          projectType,
          toolNames,
          peerActions,
        })));
      }

      // End-of-round reflection every 3 rounds (skip round 1).
      if (round > 1 && round % 3 === 0) {
        for (const agent of agents) {
          const ownActions = (await getSimulationLogs(runId, 200)).filter((l) => l.agentName === agent.name);
          await reflectAgent({ agent: { id: agent.id, agentId: agent.agentId, name: agent.name }, projectId, simulationRunId: runId, round, ownActions });
        }
      }

      await decayMemories(projectId, 0.96);
    }

    await updateSimulationRun(runId, { status: "completed", completedAt: new Date() });
    await updateProject(projectId, { status: "completed" });
    emitSimulationStatus(runId, "completed", totalRounds, totalRounds);

    await notifyOwner({
      title: "Simulation Completed",
      content: `Simulation run #${runId} for project #${projectId} completed (${totalRounds} rounds, ${agents.length} agents, with persistent memory).`,
    });
  } catch (err) {
    console.error("[sim] run failed:", err);
    await updateSimulationRun(opts.runId, {
      status: "failed",
      errorMessage: err instanceof Error ? err.message : "Unknown error",
      completedAt: new Date(),
    });
    await updateProject(opts.projectId, { status: "failed" });
    emitSimulationStatus(opts.runId, "failed", 0, opts.totalRounds);
  }
}

async function stepAgent(args: {
  agent: { id: number; agentId: string; name: string; persona?: string | null; ideology?: string | null; platform?: string | null };
  topic: string;
  round: number;
  runId: number;
  projectId: number;
  projectType: "narrative" | "technical" | "finance";
  toolNames: ToolName[];
  peerActions: Array<{ agentName: string | null; action: string | null; content: string | null }>;
}): Promise<void> {
  const { agent, topic, round, runId, projectId, projectType, toolNames, peerActions } = args;

  // Recall — vector retrieval of own memories relevant to the current peer chatter.
  const recallQuery = peerActions.length > 0
    ? `Recent peer chatter on ${topic}: ${peerActions.slice(-5).map((p) => p.content ?? "").join(" | ").slice(0, 600)}`
    : `Opening reflections on ${topic}`;
  let memories: Array<{ kind: string; content: string; round: number | null; salience: number }> = [];
  try {
    const recalled = await recall({ projectId, agentId: agent.agentId, query: recallQuery, k: 5 });
    memories = recalled.map((m) => ({ kind: m.kind, content: m.content, round: m.round, salience: m.salience }));
  } catch (err) {
    console.warn(`[sim] recall failed for ${agent.name}:`, err);
  }

  // Decide — first pass
  let decision = await decideAgentAction({ agent, topic, round, projectType, toolNames, peerActions, memories });

  // Tool execution: if the agent requested a tool and the project type allows it,
  // execute it and re-ask once with the result so the agent can incorporate it.
  if (decision.toolCall && toolNames.includes(decision.toolCall.tool)) {
    const tr = await executeTool(decision.toolCall);
    decision = await decideAgentAction({
      agent, topic, round, projectType, toolNames, peerActions, memories,
      toolResultForLastTool: `${tr.tool}(${JSON.stringify(decision.toolCall.args)}) → ${tr.ok ? "OK" : "ERR"}: ${tr.output}`,
    });
  }

  // Choose platform — respect agent.platform if set, else random.
  const platform = (agent.platform as "twitter" | "reddit" | undefined) ?? PLATFORM_CHOICES[Math.floor(Math.random() * PLATFORM_CHOICES.length)];
  const timestamp = new Date().toISOString();

  // Persist log
  await addSimulationLog({
    simulationRunId: runId,
    projectId,
    round,
    agentName: agent.name,
    platform,
    action: decision.action,
    content: decision.content,
    logLevel: "info",
  });

  // Emit live event (Phase 1.3)
  emitSimulationLog(runId, {
    round,
    agentName: agent.name,
    platform,
    action: decision.action,
    content: decision.content,
    logLevel: "info",
    timestamp,
  });

  // Remember own action (high salience — own actions are formative).
  await remember({
    projectId,
    agentId: agent.agentId,
    simulationRunId: runId,
    round,
    kind: "action",
    content: `[${decision.action}] ${decision.content}`,
    salience: 1.2,
    metadata: { platform, reasoning: decision.reasoning ?? null },
  });

  // Remember peer chatter as observations (lower salience — others' actions decay faster).
  if (peerActions.length > 0) {
    const sample = peerActions.slice(-3);
    for (const p of sample) {
      if (!p.content || !p.agentName || p.agentName === agent.name) continue;
      await remember({
        projectId,
        agentId: agent.agentId,
        simulationRunId: runId,
        round,
        kind: "observation",
        content: `Saw ${p.agentName} ${p.action ?? "act"}: ${p.content.slice(0, 240)}`,
        salience: 0.7,
      }).catch(() => undefined);
    }
  }

  // Dynamic graph enrichment (Phase 1.4) — write through to graph_nodes/edges + record event.
  if (decision.newEntity?.id && decision.newEntity?.label) {
    try {
      await upsertGraphNodes([{
        projectId,
        nodeId: decision.newEntity.id,
        label: decision.newEntity.label,
        type: decision.newEntity.type ?? "entity",
        description: decision.newEntity.description ?? `Surfaced by ${agent.name} in round ${round}.`,
      }]);
      await addGraphEvent({
        projectId,
        simulationRunId: runId,
        round,
        eventType: "node_added",
        refNodeId: decision.newEntity.id,
        delta: { label: decision.newEntity.label, type: decision.newEntity.type ?? "entity" },
        reason: `${agent.name} surfaced this entity`,
      });
      emitGraphEvent(projectId, { type: "node_added", nodeId: decision.newEntity.id, label: decision.newEntity.label, round, agentName: agent.name });
    } catch (err) {
      console.warn(`[sim] graph node enrichment failed:`, err);
    }
  }
  if (decision.newRelation?.source && decision.newRelation?.target) {
    try {
      await upsertGraphEdges([{
        projectId,
        sourceId: decision.newRelation.source,
        targetId: decision.newRelation.target,
        label: decision.newRelation.label ?? "related_to",
        weight: 0.6,
      }]);
      await addGraphEvent({
        projectId,
        simulationRunId: runId,
        round,
        eventType: "edge_added",
        refEdgeFrom: decision.newRelation.source,
        refEdgeTo: decision.newRelation.target,
        delta: { label: decision.newRelation.label ?? "related_to" },
        reason: `${agent.name} drew this connection`,
      });
      emitGraphEvent(projectId, { type: "edge_added", source: decision.newRelation.source, target: decision.newRelation.target, label: decision.newRelation.label ?? "related_to", round, agentName: agent.name });
    } catch (err) {
      console.warn(`[sim] graph edge enrichment failed:`, err);
    }
  }
}
