// Task-routed multi-LLM client.
// Strategy: prefer the best-fit direct provider when its key is configured,
// fall back to Manus Forge (which itself routes to Gemini/Claude/GPT). This means
// the app always works (Forge is free on Manus) but upgrades transparently to
// the strongest model per task when the user adds OPENAI/ANTHROPIC/GEMINI keys.

import { ENV } from "./_core/env";
import { invokeLLM, type Message } from "./_core/llm";

export type LLMTask =
  | "graph_extraction"     // long-context, structured JSON, cheap. Default: Gemini 2.5 Flash
  | "persona_generation"   // creative, nuanced characters. Default: Claude Opus 4.7
  | "report_generation"    // agentic reasoning, ReACT, structured analysis. Default: Claude Opus 4.7 / GPT-5
  | "agent_action"         // per-round per-agent decisions, cheap & fast. Default: Claude Haiku 4.5 / Gemini 2.5 Flash
  | "agent_chat"           // interactive conversation. Default: Claude Sonnet 4.6
  | "reflection"           // agent self-reflection (memory consolidation). Default: Claude Sonnet 4.6
  | "prediction_critique"; // confidence calibration. Default: Claude Opus 4.7

// Latest & best models as of 2026-01 knowledge cutoff.
// Override at runtime by setting LLM_MODEL_<TASK_UPPER>=model-id in env.
const MODEL_DEFAULTS: Record<LLMTask, { anthropic: string; openai: string; gemini: string; forge: string }> = {
  graph_extraction:    { anthropic: "claude-haiku-4-5",  openai: "gpt-4.1-mini",      gemini: "gemini-2.5-flash", forge: "gemini-2.5-flash" },
  persona_generation:  { anthropic: "claude-opus-4-7",   openai: "gpt-5",             gemini: "gemini-2.5-pro",   forge: "claude-opus-4-7" },
  report_generation:   { anthropic: "claude-opus-4-7",   openai: "gpt-5",             gemini: "gemini-2.5-pro",   forge: "claude-opus-4-7" },
  agent_action:        { anthropic: "claude-haiku-4-5",  openai: "gpt-4.1-mini",      gemini: "gemini-2.5-flash", forge: "gemini-2.5-flash" },
  agent_chat:          { anthropic: "claude-sonnet-4-6", openai: "gpt-5",             gemini: "gemini-2.5-pro",   forge: "claude-sonnet-4-6" },
  reflection:          { anthropic: "claude-sonnet-4-6", openai: "gpt-4.1",           gemini: "gemini-2.5-flash", forge: "claude-sonnet-4-6" },
  prediction_critique: { anthropic: "claude-opus-4-7",   openai: "gpt-5",             gemini: "gemini-2.5-pro",   forge: "claude-opus-4-7" },
};

// Task → preferred provider order. Direct providers tried first when key available.
const TASK_PREFERENCE: Record<LLMTask, Array<"anthropic" | "openai" | "gemini" | "forge">> = {
  graph_extraction:    ["gemini", "anthropic", "openai", "forge"],
  persona_generation:  ["anthropic", "openai", "gemini", "forge"],
  report_generation:   ["anthropic", "openai", "gemini", "forge"],
  agent_action:        ["anthropic", "gemini", "openai", "forge"],
  agent_chat:          ["anthropic", "openai", "gemini", "forge"],
  reflection:          ["anthropic", "gemini", "openai", "forge"],
  prediction_critique: ["anthropic", "openai", "gemini", "forge"],
};

function envOverride(task: LLMTask): string | undefined {
  const key = `LLM_MODEL_${task.toUpperCase()}`;
  const v = process.env[key];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

export interface CompleteParams {
  task: LLMTask;
  systemPrompt?: string;
  prompt?: string;
  messages?: Message[];
  responseFormat?: "text" | "json";
  jsonSchema?: { name: string; schema: Record<string, unknown>; strict?: boolean };
  maxTokens?: number;
  temperature?: number;
  model?: string; // hard override
}

export interface CompleteResult {
  text: string;
  json?: unknown;
  provider: "anthropic" | "openai" | "gemini" | "forge";
  model: string;
}

export async function complete(params: CompleteParams): Promise<CompleteResult> {
  const messages: Message[] = params.messages ?? [];
  if (params.systemPrompt && !messages.some((m) => m.role === "system")) {
    messages.unshift({ role: "system", content: params.systemPrompt });
  }
  if (params.prompt) {
    messages.push({ role: "user", content: params.prompt });
  }
  if (messages.length === 0) {
    throw new Error("complete(): provide either messages or prompt");
  }

  const order = TASK_PREFERENCE[params.task];
  const overrideModel = params.model ?? envOverride(params.task);
  const errors: string[] = [];

  for (const provider of order) {
    if (!isProviderAvailable(provider)) continue;
    const model = overrideModel ?? MODEL_DEFAULTS[params.task][provider];
    try {
      return await callProvider(provider, model, messages, params);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${provider}/${model}] ${msg}`);
      // try next provider
    }
  }

  throw new Error(`All LLM providers failed for task=${params.task}: ${errors.join(" | ")}`);
}

function isProviderAvailable(p: "anthropic" | "openai" | "gemini" | "forge"): boolean {
  switch (p) {
    case "anthropic": return Boolean(ENV.anthropicApiKey);
    case "openai":    return Boolean(ENV.openaiApiKey);
    case "gemini":    return Boolean(ENV.geminiApiKey);
    case "forge":     return Boolean(ENV.forgeApiKey);
  }
}

async function callProvider(
  provider: "anthropic" | "openai" | "gemini" | "forge",
  model: string,
  messages: Message[],
  params: CompleteParams,
): Promise<CompleteResult> {
  switch (provider) {
    case "anthropic": return callAnthropic(model, messages, params);
    case "openai":    return callOpenAI(model, messages, params);
    case "gemini":    return callGemini(model, messages, params);
    case "forge":     return callForge(model, messages, params);
  }
}

// ─── Anthropic ──────────────────────────────────────────────────────────────
async function callAnthropic(model: string, messages: Message[], params: CompleteParams): Promise<CompleteResult> {
  const system = messages.find((m) => m.role === "system");
  const conv = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));

  const body: Record<string, unknown> = {
    model,
    max_tokens: params.maxTokens ?? 4096,
    messages: conv,
  };
  if (system) body.system = typeof system.content === "string" ? system.content : JSON.stringify(system.content);
  if (params.temperature !== undefined) body.temperature = params.temperature;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ENV.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  return finalize({ provider: "anthropic", model, text, params });
}

// ─── OpenAI ─────────────────────────────────────────────────────────────────
async function callOpenAI(model: string, messages: Message[], params: CompleteParams): Promise<CompleteResult> {
  const body: Record<string, unknown> = {
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    })),
    max_tokens: params.maxTokens ?? 4096,
  };
  if (params.temperature !== undefined) body.temperature = params.temperature;
  if (params.responseFormat === "json") {
    body.response_format = params.jsonSchema
      ? { type: "json_schema", json_schema: params.jsonSchema }
      : { type: "json_object" };
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.openaiApiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  const text = data.choices?.[0]?.message?.content ?? "";
  return finalize({ provider: "openai", model, text, params });
}

// ─── Gemini ─────────────────────────────────────────────────────────────────
async function callGemini(model: string, messages: Message[], params: CompleteParams): Promise<CompleteResult> {
  const system = messages.find((m) => m.role === "system");
  const contents = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
    }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: params.maxTokens ?? 4096,
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      ...(params.responseFormat === "json" ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (system) {
    body.systemInstruction = { parts: [{ text: typeof system.content === "string" ? system.content : JSON.stringify(system.content) }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${ENV.geminiApiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return finalize({ provider: "gemini", model, text, params });
}

// ─── Forge fallback (uses existing helper) ──────────────────────────────────
async function callForge(model: string, messages: Message[], params: CompleteParams): Promise<CompleteResult> {
  const result = await invokeLLM({
    messages,
    maxTokens: params.maxTokens,
    ...(params.responseFormat === "json"
      ? params.jsonSchema
        ? { responseFormat: { type: "json_schema", json_schema: params.jsonSchema } }
        : { responseFormat: { type: "json_object" } }
      : {}),
  });
  const choice = result.choices?.[0]?.message?.content;
  const text = typeof choice === "string"
    ? choice
    : Array.isArray(choice)
      ? choice.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("")
      : "";
  return finalize({ provider: "forge", model: result.model || model, text, params });
}

// ─── Shared post-processing ─────────────────────────────────────────────────
function finalize(args: {
  provider: "anthropic" | "openai" | "gemini" | "forge";
  model: string;
  text: string;
  params: CompleteParams;
}): CompleteResult {
  const { provider, model, text, params } = args;
  let json: unknown;
  if (params.responseFormat === "json" && text) {
    try {
      json = JSON.parse(text);
    } catch {
      // try to recover JSON from prose
      const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (match) {
        try { json = JSON.parse(match[0]); } catch { /* leave undefined */ }
      }
    }
  }
  return { text, json, provider, model };
}

// Convenience helper used by simulation runner & legacy routers.
export async function completeText(task: LLMTask, prompt: string, systemPrompt?: string): Promise<string> {
  const r = await complete({ task, prompt, systemPrompt });
  return r.text;
}

export async function completeJson<T = unknown>(task: LLMTask, prompt: string, systemPrompt?: string): Promise<T> {
  const r = await complete({ task, prompt, systemPrompt, responseFormat: "json" });
  if (r.json === undefined) {
    throw new Error(`completeJson(${task}): provider=${r.provider} model=${r.model} returned non-JSON: ${r.text.slice(0, 200)}`);
  }
  return r.json as T;
}
