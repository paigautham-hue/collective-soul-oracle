// Gemini Deep Research client (preview models launched Apr 2026).
//
// Two variants:
//   preview — streaming, faster, used for catalyst dives & topic seeding
//   max     — heavy synthesis, used for high-fidelity reports
//
// Distinctive features (per launch notes):
//   - Collaborative planning: send a structured plan, not just a prompt
//   - MCP integration: not used in Phase A (Phase B work)
//   - Native visualizations: structured chart specs returned alongside text
//
// API shape is inferred from Google's generativelanguage v1beta conventions
// because the public preview SDK contract isn't finalised. If Google ships a
// different shape, only this file needs updating.

import { ENV } from "./_core/env";
import { logUsage, getMonthlyUsage } from "./usage";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export type DeepResearchVariant = "preview" | "max";

export interface DeepResearchPlan {
  scope: string;                              // "What this research must cover"
  sources?: string[];                         // ["arxiv.org", "sec.gov", "company filings"]
  privateContext?: Array<{ label: string; content: string }>;  // Inline private context until MCP lands (Phase B)
  outputStructure?: string[];                 // Section headings the model must produce
  citationRequirement?: "required" | "preferred" | "optional";
  visualizations?: boolean;                   // request native viz output
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
  task: string;                               // e.g. 'report_generation', 'research_seed', 'catalyst_dive'
}

export function isDeepResearchConfigured(): boolean {
  return Boolean(ENV.geminiDeepResearchKey);
}

export async function checkDeepResearchQuota(userId: number): Promise<{ usedThisMonth: number; quota: number; remaining: number }> {
  const used = await getMonthlyUsage(userId, "deep_research");
  const quota = ENV.deepResearchMonthlyQuota;
  return { usedThisMonth: used, quota, remaining: Math.max(0, quota - used) };
}

function modelFor(variant: DeepResearchVariant): string {
  return variant === "max" ? ENV.deepResearchMaxModel : ENV.deepResearchPreviewModel;
}

// Estimate cost — rough; tune once you have real billing data.
function estimateCostUsd(variant: DeepResearchVariant): number {
  return variant === "max" ? 8.0 : 1.5;
}

export async function runDeepResearch(args: RunDeepResearchArgs): Promise<DeepResearchResult> {
  if (!isDeepResearchConfigured()) {
    throw new Error("Deep Research not configured (set GEMINI_API_KEY or GEMINI_DEEP_RESEARCH_API_KEY)");
  }
  const quota = await checkDeepResearchQuota(args.userId);
  if (quota.remaining <= 0) {
    throw new Error(`Deep Research monthly quota exhausted (${quota.usedThisMonth}/${quota.quota})`);
  }

  const model = modelFor(args.variant);
  const url = `${BASE}/models/${model}:generateContent?key=${ENV.geminiDeepResearchKey}`;

  // Pack the structured plan into the user message text. The standard
  // generateContent endpoint rejects unknown top-level fields (researchPlan,
  // enableVisualizations) with HTTP 400, so we keep the body strictly conformant
  // and rely on the model to follow the embedded plan + JSON output instructions.
  const planBlock = args.plan ? buildPlanBlock(args.plan) : "";
  const userText = planBlock ? `${planBlock}\n\nREQUEST:\n${args.prompt}` : args.prompt;
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: {
      maxOutputTokens: args.variant === "max" ? 16384 : 8192,
      temperature: 0.4,
    },
  };
  if (args.systemInstruction) {
    body.systemInstruction = { parts: [{ text: args.systemInstruction }] };
  }

  const startedAt = Date.now();
  let status: "ok" | "error" = "ok";
  let resJson: unknown = null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const responseText = await res.text();
    if (!res.ok) {
      status = "error";
      throw new Error(`Deep Research ${res.status}: ${responseText.slice(0, 800)}`);
    }
    try { resJson = JSON.parse(responseText); } catch { resJson = responseText; }

    const data = resJson as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; groundingMetadata?: { citations?: Array<{ uri?: string; title?: string; snippet?: string }> } }>;
      visualizations?: DeepResearchVisualization[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const citations = (data.candidates?.[0]?.groundingMetadata?.citations ?? []).map((c) => ({
      url: c.uri,
      title: c.title,
      snippet: c.snippet,
    }));
    const visualizations = data.visualizations ?? extractInlineVisualizations(text);

    return {
      text,
      citations,
      visualizations,
      durationMs: Date.now() - startedAt,
      model,
      tokenInputEstimate: data.usageMetadata?.promptTokenCount,
      tokenOutputEstimate: data.usageMetadata?.candidatesTokenCount,
      raw: data,
    };
  } finally {
    // Always log usage so quota counting works even on errors.
    await logUsage({
      userId: args.userId,
      projectId: args.projectId ?? null,
      task: "deep_research",
      provider: "gemini",
      model,
      callMs: Date.now() - startedAt,
      costEstimateUsd: estimateCostUsd(args.variant),
      status,
    });
  }
}

function buildPlanBlock(plan: DeepResearchPlan): string {
  const lines = ["RESEARCH PLAN:"];
  lines.push(`- Scope: ${plan.scope}`);
  if (plan.sources?.length) lines.push(`- Preferred sources: ${plan.sources.join(", ")}`);
  if (plan.outputStructure?.length) lines.push(`- Required output sections: ${plan.outputStructure.join(" → ")}`);
  if (plan.citationRequirement) lines.push(`- Citations: ${plan.citationRequirement}`);
  if (plan.visualizations) lines.push(`- Include native visualizations (charts, tables, infographics) where they aid understanding`);
  if (plan.privateContext?.length) {
    lines.push("- Private context blocks the user has provided:");
    for (const ctx of plan.privateContext) lines.push(`  • ${ctx.label}: ${ctx.content.slice(0, 4000)}`);
  }
  return lines.join("\n");
}

// Fallback parser when the API returns viz inline as ```viz JSON``` blocks.
function extractInlineVisualizations(text: string): DeepResearchVisualization[] {
  const out: DeepResearchVisualization[] = [];
  const re = /```viz\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    try { out.push(JSON.parse(m[1]) as DeepResearchVisualization); } catch { /* skip */ }
  }
  return out;
}
