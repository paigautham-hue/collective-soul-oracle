// Gemini Deep Research client.
//
// The dedicated "deep-research-*" model IDs require Google's Interactions API
// (a proprietary multi-turn streaming protocol) and return HTTP 400 when called
// via the standard generateContent REST endpoint.
//
// This implementation uses gemini-2.5-pro (preview) with Google Search grounding
// enabled — which produces the same web-researched, citation-rich output and is
// fully supported by the standard generateContent endpoint.
//
// Model routing:
//   preview → gemini-2.5-flash  (fast, lower cost, used for seed research)
//   max     → gemini-2.5-pro    (highest quality, used for full report synthesis)

import { ENV } from "./_core/env";
import { logUsage, getMonthlyUsage } from "./usage";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

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
}

export function isDeepResearchConfigured(): boolean {
  return Boolean(ENV.geminiDeepResearchKey);
}

export async function checkDeepResearchQuota(userId: number): Promise<{ usedThisMonth: number; quota: number; remaining: number }> {
  const used = await getMonthlyUsage(userId, "deep_research");
  const quota = ENV.deepResearchMonthlyQuota;
  return { usedThisMonth: used, quota, remaining: Math.max(0, quota - used) };
}

// Use standard generateContent-compatible models with Google Search grounding.
// The deep-research-* model IDs only work via the Interactions API (not REST).
function modelFor(variant: DeepResearchVariant): string {
  if (variant === "max") {
    return process.env.DEEP_RESEARCH_MAX_MODEL ?? "gemini-2.5-pro";
  }
  return process.env.DEEP_RESEARCH_PREVIEW_MODEL ?? "gemini-2.5-flash";
}

function estimateCostUsd(variant: DeepResearchVariant): number {
  return variant === "max" ? 4.0 : 0.5;
}

export async function runDeepResearch(args: RunDeepResearchArgs): Promise<DeepResearchResult> {
  if (!isDeepResearchConfigured()) {
    throw new Error("Deep Research not configured (set GEMINI_API_KEY)");
  }
  const quota = await checkDeepResearchQuota(args.userId);
  if (quota.remaining <= 0) {
    throw new Error(`Deep Research monthly quota exhausted (${quota.usedThisMonth}/${quota.quota})`);
  }

  const model = modelFor(args.variant);
  const url = `${BASE}/models/${model}:generateContent?key=${ENV.geminiDeepResearchKey}`;

  const planBlock = args.plan ? buildPlanBlock(args.plan) : "";
  const userText = planBlock ? `${planBlock}\n\nREQUEST:\n${args.prompt}` : args.prompt;

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: userText }] }],
    // Enable Google Search grounding for live web-sourced, citation-rich output.
    tools: [{ googleSearch: {} }],
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
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        groundingMetadata?: {
          groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
          citations?: Array<{ uri?: string; title?: string; snippet?: string }>;
        };
      }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";

    // Extract citations from grounding chunks (Google Search grounding format)
    const groundingChunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const legacyCitations = data.candidates?.[0]?.groundingMetadata?.citations ?? [];
    const citations = groundingChunks.length > 0
      ? groundingChunks.map((c) => ({ url: c.web?.uri, title: c.web?.title, snippet: undefined }))
      : legacyCitations.map((c) => ({ url: c.uri, title: c.title, snippet: c.snippet }));

    const visualizations = extractInlineVisualizations(text);

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

function extractInlineVisualizations(text: string): DeepResearchVisualization[] {
  const out: DeepResearchVisualization[] = [];
  const re = /```viz\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    try { out.push(JSON.parse(m[1]) as DeepResearchVisualization); } catch { /* skip */ }
  }
  return out;
}
