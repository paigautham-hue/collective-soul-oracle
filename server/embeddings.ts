import { ENV } from "./_core/env";

const FORGE_BASE = ENV.forgeApiUrl?.trim()
  ? ENV.forgeApiUrl.replace(/\/$/, "")
  : "https://forge.manus.im";

const OPENAI_BASE = "https://api.openai.com";

function pickProvider(): { url: string; key: string; model: string } {
  if (ENV.openaiApiKey) {
    return {
      url: `${OPENAI_BASE}/v1/embeddings`,
      key: ENV.openaiApiKey,
      model: ENV.embeddingsModel,
    };
  }
  if (!ENV.forgeApiKey) {
    throw new Error("No embeddings provider configured (OPENAI_API_KEY or BUILT_IN_FORGE_API_KEY)");
  }
  return {
    url: `${FORGE_BASE}/v1/embeddings`,
    key: ENV.forgeApiKey,
    model: ENV.embeddingsModel,
  };
}

export async function embed(input: string | string[]): Promise<number[][]> {
  const inputs = Array.isArray(input) ? input : [input];
  if (inputs.length === 0) return [];

  const { url, key, model } = pickProvider();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, input: inputs }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Embeddings request failed: ${res.status} ${res.statusText} – ${text}`);
  }

  const json = (await res.json()) as { data: Array<{ embedding: number[]; index: number }> };
  const ordered = [...json.data].sort((a, b) => a.index - b.index);
  return ordered.map((d) => d.embedding);
}

export async function embedOne(text: string): Promise<number[]> {
  const [vec] = await embed(text);
  return vec;
}

export function cosine(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
