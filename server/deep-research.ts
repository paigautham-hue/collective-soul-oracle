// Gemini Deep Research — Interactions API client (Node.js/TypeScript)
//
// Deep Research is EXCLUSIVELY available via the Interactions API.
// It CANNOT be called through generateContent — that always returns HTTP 400.
//
// Official REST endpoint (v1beta):
//   POST   https://generativelanguage.googleapis.com/v1beta/interactions
//   GET    https://generativelanguage.googleapis.com/v1beta/interactions/{id}
//   POST   https://generativelanguage.googleapis.com/v1beta/interactions/{id}/cancel
//
// Source: https://ai.google.dev/api/interactions-api
//         https://ai.google.dev/gemini-api/docs/deep-research
//
// Two agent versions:
//   deep-research-preview-04-2026  — speed & efficiency, ideal for streaming to UI
//   deep-research-max-preview-04-2026 — maximum comprehensiveness for synthesis
//
// Flow:
//   1. POST /interactions  { agent, input, background: true, agent_config: { type: "deep-research" } }
//   2. Poll GET /interactions/{id} every 5s until status === "completed" | "failed"
//   3. Return outputs[].text + citations from GoogleSearchResultContent items

import { ENV } from "./_core/env";
import { logUsage, getMonthlyUsage } from "./usage";

const INTERACTIONS_BASE = "https://generativelanguage.googleapis.com/v1beta/interactions";
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 120; // 10 minutes max

export type DeepResearchVariant = "preview" | "max";

export interface DeepResearchPlan {
  scope: string;
  sources?: string[];
  privateContext?: Array<{ label: string; content: string }>;
  outputStructure?: string[];
  citationRequirement?: "required" | "preferred" | "optional";
  visualizations?: boolean;
  maxLatencyMs?: number;
}

export interface DeepResearchVisualization {
  type: "bar" | "line" | "pie" | "table" | "infographic" | string;
  title?: string;
  data?: unknown;
  caption?: string;
}

export interface DeepResearchResult {
  text: string;
  citations: Array<{ url?: string; title?: string; snippet?: string }>;
  visualizations: DeepResearchVisualization[];
  durationMs: number;
  model: string;
  interactionId?: string;
  tokenInputEstimate?: number;
  tokenOutputEstimate?: number;
  raw?: unknown;
}

export interface RunDeepResearchArgs {
  variant: DeepResearchVariant;
  prompt: string;
  plan?: DeepResearchPlan;
  systemInstruction?: string;
  userId: number;
  projectId?: number | null;
  task: string;
  /** Enable collaborative planning mode — returns a plan for review before executing */
  collaborativePlanning?: boolean;
  /** ID of a previous interaction to continue from (for plan refinement) */
  previousInteractionId?: string;
  /** Enable native chart/infographic generation */
  visualizations?: boolean;
}

export function isDeepResearchConfigured(): boolean {
  return Boolean(ENV.geminiDeepResearchKey);
}

export async function checkDeepResearchQuota(userId: number): Promise<{
  usedThisMonth: number;
  quota: number;
  remaining: number;
}> {
  const used = await getMonthlyUsage(userId, "deep_research");
  const quota = ENV.deepResearchMonthlyQuota;
  return { usedThisMonth: used, quota, remaining: Math.max(0, quota - used) };
}

function agentFor(variant: DeepResearchVariant): string {
  return variant === "max"
    ? (process.env.DEEP_RESEARCH_MAX_MODEL ?? "deep-research-max-preview-04-2026")
    : (process.env.DEEP_RESEARCH_PREVIEW_MODEL ?? "deep-research-preview-04-2026");
}

function estimateCostUsd(variant: DeepResearchVariant): number {
  return variant === "max" ? 8.0 : 1.5;
}

/** Create a new interaction via the Interactions API */
async function createInteraction(
  agent: string,
  input: string,
  options: {
    systemInstruction?: string;
    collaborativePlanning?: boolean;
    previousInteractionId?: string;
    visualizations?: boolean;
    apiKey: string;
  }
): Promise<{ id: string; status: string }> {
  const body: Record<string, unknown> = {
    agent,
    input,
    background: true,
    agent_config: {
      type: "deep-research",
      collaborative_planning: options.collaborativePlanning ?? false,
      visualization: options.visualizations ? "auto" : "off",
      thinking_summaries: "none",
    },
  };

  if (options.systemInstruction) {
    body.system_instruction = options.systemInstruction;
  }
  if (options.previousInteractionId) {
    body.previous_interaction_id = options.previousInteractionId;
  }

  const res = await fetch(`${INTERACTIONS_BASE}?key=${options.apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Interactions API create failed ${res.status}: ${text.slice(0, 800)}`);
  }

  const data = JSON.parse(text) as { id: string; status: string };
  return data;
}

/** Poll an interaction until it completes or fails */
async function pollInteraction(
  id: string,
  apiKey: string
): Promise<InteractionResource> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const res = await fetch(`${INTERACTIONS_BASE}/${id}?key=${apiKey}`, {
      method: "GET",
      headers: { "content-type": "application/json" },
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Interactions API poll failed ${res.status}: ${text.slice(0, 400)}`);
    }

    const data = JSON.parse(text) as InteractionResource;

    if (data.status === "completed") return data;
    if (data.status === "failed") {
      throw new Error(`Deep Research interaction failed: ${JSON.stringify(data).slice(0, 400)}`);
    }
    if (data.status === "cancelled") {
      throw new Error("Deep Research interaction was cancelled");
    }

    // Still in_progress — wait and retry
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Deep Research timed out after ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s`);
}

/** Extract text and citations from a completed interaction */
function extractResults(data: InteractionResource): {
  text: string;
  citations: Array<{ url?: string; title?: string; snippet?: string }>;
  visualizations: DeepResearchVisualization[];
} {
  const outputs = data.outputs ?? [];

  // Collect all text parts
  const textParts: string[] = [];
  const citations: Array<{ url?: string; title?: string; snippet?: string }> = [];
  const visualizations: DeepResearchVisualization[] = [];

  for (const output of outputs) {
    if (output.type === "text" && output.text) {
      textParts.push(output.text);
    }
    // GoogleSearchResultContent contains grounding citations
    if (output.type === "google_search_result" && output.results) {
      for (const r of output.results) {
        citations.push({ url: r.uri, title: r.title, snippet: r.snippet });
      }
    }
    // ImageContent from visualization
    if (output.type === "image" && output.data) {
      visualizations.push({
        type: "infographic",
        data: output.data,
        caption: output.caption,
      });
    }
  }

  // Fallback: extract inline visualizations from text
  const text = textParts.join("\n\n");
  if (visualizations.length === 0) {
    visualizations.push(...extractInlineVisualizations(text));
  }

  return { text, citations, visualizations };
}

export async function runDeepResearch(args: RunDeepResearchArgs): Promise<DeepResearchResult> {
  if (!isDeepResearchConfigured()) {
    throw new Error("Deep Research not configured (set GEMINI_API_KEY)");
  }

  const quota = await checkDeepResearchQuota(args.userId);
  if (quota.remaining <= 0) {
    throw new Error(`Deep Research monthly quota exhausted (${quota.usedThisMonth}/${quota.quota})`);
  }

  const agent = agentFor(args.variant);
  const apiKey = ENV.geminiDeepResearchKey;

  // Build the prompt, embedding any structured plan as context
  const planBlock = args.plan ? buildPlanBlock(args.plan) : "";
  const fullPrompt = planBlock ? `${planBlock}\n\nREQUEST:\n${args.prompt}` : args.prompt;

  const startedAt = Date.now();
  let status: "ok" | "error" = "ok";
  let interactionId: string | undefined;

  try {
    // Step 1: Create the interaction (returns immediately with an ID)
    const created = await createInteraction(agent, fullPrompt, {
      systemInstruction: args.systemInstruction,
      collaborativePlanning: args.collaborativePlanning,
      previousInteractionId: args.previousInteractionId,
      visualizations: args.plan?.visualizations ?? args.visualizations,
      apiKey,
    });

    interactionId = created.id;

    // Step 2: Poll until complete
    const completed = await pollInteraction(interactionId, apiKey);

    // Step 3: Extract results
    const { text, citations, visualizations } = extractResults(completed);

    return {
      text,
      citations,
      visualizations,
      durationMs: Date.now() - startedAt,
      model: agent,
      interactionId,
      tokenInputEstimate: completed.usage?.inputTokenCount,
      tokenOutputEstimate: completed.usage?.outputTokenCount,
      raw: completed,
    };
  } catch (err) {
    status = "error";
    throw err;
  } finally {
    await logUsage({
      userId: args.userId,
      projectId: args.projectId ?? null,
      task: "deep_research",
      provider: "gemini",
      model: agent,
      callMs: Date.now() - startedAt,
      costEstimateUsd: estimateCostUsd(args.variant),
      status,
    });
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface InteractionResource {
  id?: string;
  status?: "in_progress" | "requires_action" | "completed" | "failed" | "cancelled";
  outputs?: Array<{
    type?: string;
    text?: string;
    data?: string;
    caption?: string;
    results?: Array<{ uri?: string; title?: string; snippet?: string }>;
  }>;
  usage?: {
    inputTokenCount?: number;
    outputTokenCount?: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPlanBlock(plan: DeepResearchPlan): string {
  const lines = ["RESEARCH PLAN:"];
  lines.push(`- Scope: ${plan.scope}`);
  if (plan.sources?.length) lines.push(`- Preferred sources: ${plan.sources.join(", ")}`);
  if (plan.outputStructure?.length)
    lines.push(`- Required output sections: ${plan.outputStructure.join(" → ")}`);
  if (plan.citationRequirement) lines.push(`- Citations: ${plan.citationRequirement}`);
  if (plan.visualizations)
    lines.push(`- Include native visualizations (charts, tables, infographics) where they aid understanding`);
  if (plan.privateContext?.length) {
    lines.push("- Private context blocks the user has provided:");
    for (const ctx of plan.privateContext)
      lines.push(`  • ${ctx.label}: ${ctx.content.slice(0, 4000)}`);
  }
  return lines.join("\n");
}

function extractInlineVisualizations(text: string): DeepResearchVisualization[] {
  const out: DeepResearchVisualization[] = [];
  const re = /```viz\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    try {
      out.push(JSON.parse(m[1]) as DeepResearchVisualization);
    } catch {
      /* skip malformed blocks */
    }
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
