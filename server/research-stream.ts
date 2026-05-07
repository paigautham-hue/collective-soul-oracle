// research-stream.ts
// SSE endpoint: /api/research/stream?interactionId=<id>
//
// Streams live thought summaries and progress updates from a running
// Gemini Deep Research interaction via Server-Sent Events.
//
// The Interactions API supports streaming by polling GET /interactions/{id}
// with stream=true (SSE). We proxy that stream to the browser client so
// the UI can show real-time progress without polling from the frontend.

import type { Express, Request, Response } from "express";

const INTERACTIONS_BASE = "https://generativelanguage.googleapis.com/v1beta/interactions";
const POLL_INTERVAL_MS = 4000;
const MAX_DURATION_MS = 12 * 60 * 1000; // 12 minutes

interface SseEvent {
  type: "thought" | "progress" | "complete" | "error" | "heartbeat";
  text?: string;
  status?: string;
  model?: string;
  durationMs?: number;
  citations?: number;
}

function sendSse(res: Response, event: SseEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function registerResearchStream(app: Express) {
  // GET /api/research/stream?interactionId=<id>
  app.get("/api/research/stream", async (req: Request, res: Response) => {
    const { interactionId } = req.query as Record<string, string>;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!interactionId) {
      res.status(400).json({ error: "interactionId required" });
      return;
    }
    if (!apiKey) {
      res.status(500).json({ error: "GEMINI_API_KEY not configured" });
      return;
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const startedAt = Date.now();
    let lastEventId: string | undefined;
    let seenThoughts = new Set<string>();
    let completed = false;

    // Heartbeat to keep connection alive
    const heartbeatTimer = setInterval(() => {
      if (!res.writableEnded) {
        sendSse(res, { type: "heartbeat" });
      }
    }, 15000);

    const cleanup = () => {
      clearInterval(heartbeatTimer);
      clearInterval(pollTimer);
    };

    req.on("close", cleanup);

    const pollTimer = setInterval(async () => {
      if (completed || res.writableEnded) {
        cleanup();
        return;
      }

      if (Date.now() - startedAt > MAX_DURATION_MS) {
        sendSse(res, { type: "error", text: "Research timed out after 12 minutes" });
        cleanup();
        res.end();
        return;
      }

      try {
        // Poll the interaction for current state + any new thought outputs
        const url = new URL(`${INTERACTIONS_BASE}/${interactionId}`);
        url.searchParams.set("key", apiKey);
        url.searchParams.set("include_input", "false");
        if (lastEventId) url.searchParams.set("last_event_id", lastEventId);

        const pollRes = await fetch(url.toString(), {
          headers: { "content-type": "application/json" },
        });

        if (!pollRes.ok) {
          const errText = await pollRes.text();
          sendSse(res, { type: "error", text: `Poll failed ${pollRes.status}: ${errText.slice(0, 200)}` });
          cleanup();
          res.end();
          return;
        }

        const data = await pollRes.json() as {
          id?: string;
          status?: string;
          outputs?: Array<{
            type?: string;
            text?: string;
            summary?: string;
          }>;
          usage?: { inputTokenCount?: number; outputTokenCount?: number };
        };

        // Extract and stream any new thought summaries
        const outputs = data.outputs ?? [];
        for (const output of outputs) {
          // ThoughtContent items contain intermediate reasoning
          if (output.type === "thought" && output.text) {
            const key = output.text.slice(0, 80);
            if (!seenThoughts.has(key)) {
              seenThoughts.add(key);
              sendSse(res, { type: "thought", text: output.text });
            }
          }
          // Progress summary updates
          if (output.type === "text" && output.text && output.text.length < 300) {
            const key = `progress:${output.text.slice(0, 80)}`;
            if (!seenThoughts.has(key)) {
              seenThoughts.add(key);
              sendSse(res, { type: "progress", text: output.text });
            }
          }
        }

        // Check completion
        if (data.status === "completed") {
          completed = true;
          const finalText = outputs.filter(o => o.type === "text").map(o => o.text ?? "").join("\n\n");
          const citations = outputs.filter(o => o.type === "google_search_result").length;
          sendSse(res, {
            type: "complete",
            text: finalText.slice(0, 2000), // send preview of final text
            status: "completed",
            durationMs: Date.now() - startedAt,
            citations,
          });
          cleanup();
          res.end();
          return;
        }

        if (data.status === "failed" || data.status === "cancelled") {
          sendSse(res, { type: "error", text: `Research ${data.status}`, status: data.status });
          cleanup();
          res.end();
          return;
        }

        // Still in_progress — send a status heartbeat with current thought count
        sendSse(res, {
          type: "progress",
          status: data.status,
          text: `Researching... (${seenThoughts.size} insights gathered, ${Math.round((Date.now() - startedAt) / 1000)}s elapsed)`,
        });

      } catch (err) {
        console.error("[research-stream] Poll error:", err);
        sendSse(res, { type: "error", text: String(err) });
        cleanup();
        res.end();
      }
    }, POLL_INTERVAL_MS);
  });
}
