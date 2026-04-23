// Extract structured predictions from a generated report and persist them
// with confidence + horizon. Later, an admin can resolve each prediction
// against ground truth and we compute Brier scores for calibration.

import { complete } from "./llm-router";
import { createPrediction, getUnresolvedPredictions, resolvePrediction, getPredictionsByProject } from "./db-extensions";

export interface ExtractedPrediction {
  claim: string;
  predictedOutcome: string;
  confidence: number;          // 0..1
  confidenceBandLow?: number;  // 0..1
  confidenceBandHigh?: number; // 0..1
  horizonDays?: number;
}

const EXTRACT_SCHEMA = {
  name: "Predictions",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["predictions"],
    properties: {
      predictions: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["claim", "predictedOutcome", "confidence"],
          properties: {
            claim: { type: "string", maxLength: 280 },
            predictedOutcome: { type: "string", maxLength: 400 },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            confidenceBandLow: { type: "number", minimum: 0, maximum: 1 },
            confidenceBandHigh: { type: "number", minimum: 0, maximum: 1 },
            horizonDays: { type: "integer", minimum: 1, maximum: 3650 },
          },
        },
      },
    },
  },
  strict: false,
} as const;

const EXTRACT_SYSTEM = `You are a calibration-aware forecasting analyst. Extract distinct, falsifiable predictions from the report. For each:
- "claim" — the prediction stated as a single short sentence
- "predictedOutcome" — what specifically will happen
- "confidence" — your honest probability (0..1) the outcome occurs as stated
- "confidenceBandLow" / "confidenceBandHigh" — 80% credible interval bounds (optional)
- "horizonDays" — when this should resolve, in days from today (optional)
Be conservative with confidence. Do not invent claims; only extract what the report actually predicts. Output JSON matching the Predictions schema.`;

export async function extractPredictions(reportContent: string): Promise<ExtractedPrediction[]> {
  if (!reportContent || reportContent.length < 50) return [];
  try {
    const r = await complete({
      task: "prediction_critique",
      systemPrompt: EXTRACT_SYSTEM,
      prompt: `REPORT:\n\n${reportContent.slice(0, 16000)}\n\nExtract predictions as JSON.`,
      responseFormat: "json",
      jsonSchema: EXTRACT_SCHEMA,
      maxTokens: 1500,
      temperature: 0.2,
    });
    const parsed = (r.json as { predictions?: ExtractedPrediction[] } | undefined)?.predictions;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => p.claim && p.predictedOutcome && typeof p.confidence === "number");
  } catch (err) {
    console.warn("[predictions] extraction failed:", err);
    return [];
  }
}

export async function persistExtractedPredictions(args: {
  projectId: number;
  reportId: number;
  simulationRunId?: number | null;
  predictions: ExtractedPrediction[];
}): Promise<void> {
  for (const p of args.predictions) {
    const resolutionDate = p.horizonDays ? new Date(Date.now() + p.horizonDays * 86400_000) : null;
    await createPrediction({
      projectId: args.projectId,
      reportId: args.reportId,
      simulationRunId: args.simulationRunId ?? null,
      claim: p.claim,
      predictedOutcome: p.predictedOutcome,
      confidence: p.confidence,
      confidenceBandLow: p.confidenceBandLow ?? null,
      confidenceBandHigh: p.confidenceBandHigh ?? null,
      horizonDays: p.horizonDays ?? null,
      resolutionDate,
    });
  }
}

// Brier score for binary outcome: (forecast - outcome)^2  where outcome ∈ {0,1}
export function brierBinary(confidence: number, occurred: boolean): number {
  const o = occurred ? 1 : 0;
  return Math.pow(confidence - o, 2);
}

// Project-level calibration summary: mean confidence, mean Brier (resolved),
// resolution rate, and a 10-bin reliability table.
export interface CalibrationSummary {
  total: number;
  resolved: number;
  meanConfidence: number;
  meanBrier: number | null;
  reliability: Array<{ bin: string; predicted: number; observed: number; n: number }>;
}

export async function summarizeCalibration(projectId: number): Promise<CalibrationSummary> {
  const all = await getPredictionsByProject(projectId);
  const total = all.length;
  const resolved = all.filter((p) => p.resolvedAt !== null);
  const meanConfidence = total > 0 ? all.reduce((s, p) => s + (p.confidence ?? 0), 0) / total : 0;
  const meanBrier = resolved.length > 0
    ? resolved.reduce((s, p) => s + (p.brierScore ?? 0), 0) / resolved.length
    : null;

  // 10-bin reliability over resolved
  const bins: Array<{ predicted: number[]; observed: number[]; n: number }> = Array.from({ length: 10 }, () => ({ predicted: [], observed: [], n: 0 }));
  for (const p of resolved) {
    const idx = Math.min(9, Math.floor((p.confidence ?? 0) * 10));
    bins[idx].predicted.push(p.confidence ?? 0);
    // For now we treat any non-empty groundTruth as "occurred" if it doesn't start with "no"
    const occurred = !!p.groundTruth && !/^\s*no\b/i.test(p.groundTruth);
    bins[idx].observed.push(occurred ? 1 : 0);
    bins[idx].n += 1;
  }

  const reliability = bins.map((b, i) => ({
    bin: `${i / 10}-${(i + 1) / 10}`,
    predicted: b.predicted.length > 0 ? b.predicted.reduce((s, x) => s + x, 0) / b.predicted.length : 0,
    observed: b.observed.length > 0 ? b.observed.reduce((s, x) => s + x, 0) / b.observed.length : 0,
    n: b.n,
  }));

  return { total, resolved: resolved.length, meanConfidence, meanBrier, reliability };
}

export { getUnresolvedPredictions, resolvePrediction };
