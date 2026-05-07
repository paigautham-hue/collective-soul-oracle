// ResearchProgressPanel.tsx
// Animated live thought-stream panel for Gemini Deep Research.
// Connects to /api/research/stream?interactionId=<id> via SSE and renders
// each thought as it arrives — giving users a real-time window into the AI's
// reasoning process while the 2–3 minute research run completes.

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, CheckCircle2, AlertCircle, Loader2, BookOpen } from "lucide-react";

interface SseEvent {
  type: "thought" | "progress" | "complete" | "error" | "heartbeat";
  text?: string;
  status?: string;
  durationMs?: number;
  citations?: number;
}

interface ThoughtEntry {
  id: string;
  text: string;
  type: "thought" | "progress" | "complete" | "error";
}

interface ResearchProgressPanelProps {
  interactionId: string;
  onComplete?: (data: { text: string; durationMs: number; citations: number }) => void;
  onError?: (message: string) => void;
  className?: string;
}

export function ResearchProgressPanel({
  interactionId,
  onComplete,
  onError,
  className = "",
}: ResearchProgressPanelProps) {
  const [thoughts, setThoughts] = useState<ThoughtEntry[]>([]);
  const [status, setStatus] = useState<"connecting" | "running" | "complete" | "error">("connecting");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [citations, setCitations] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<number>(Date.now());

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsedMs(Date.now() - startRef.current), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thoughts]);

  const addThought = useCallback((entry: Omit<ThoughtEntry, "id">) => {
    setThoughts(prev => [
      ...prev,
      { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
    ]);
  }, []);

  useEffect(() => {
    if (!interactionId) return;
    const es = new EventSource(`/api/research/stream?interactionId=${encodeURIComponent(interactionId)}`);
    setStatus("running");

    es.onmessage = (e) => {
      try {
        const event: SseEvent = JSON.parse(e.data);
        if (event.type === "heartbeat") return;
        if (event.type === "thought" && event.text) addThought({ type: "thought", text: event.text });
        if (event.type === "progress" && event.text) addThought({ type: "progress", text: event.text });
        if (event.type === "complete") {
          setStatus("complete");
          setCitations(event.citations ?? 0);
          addThought({ type: "complete", text: `Research complete in ${((event.durationMs ?? 0) / 1000).toFixed(1)}s — ${event.citations ?? 0} sources consulted.` });
          onComplete?.({ text: event.text ?? "", durationMs: event.durationMs ?? 0, citations: event.citations ?? 0 });
          es.close();
        }
        if (event.type === "error") {
          setStatus("error");
          addThought({ type: "error", text: event.text ?? "An error occurred during research." });
          onError?.(event.text ?? "Research failed");
          es.close();
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      if (status !== "complete") {
        setStatus("error");
        addThought({ type: "error", text: "Lost connection to research stream." });
        onError?.("Connection lost");
      }
      es.close();
    };

    return () => es.close();
  }, [interactionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const elapsed = elapsedMs / 1000;
  const elapsedStr = `${Math.floor(elapsed / 60)}:${Math.floor(elapsed % 60).toString().padStart(2, "0")}`;

  return (
    <div className={`flex flex-col rounded-2xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-xl ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Brain className="w-4 h-4 text-indigo-400" />
            {status === "running" && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            )}
          </div>
          <span className="font-mono text-xs text-white/70 tracking-wider uppercase">
            Deep Research — Thought Stream
          </span>
        </div>
        <div className="flex items-center gap-3">
          {citations > 0 && (
            <div className="flex items-center gap-1 text-amber-400/80">
              <BookOpen className="w-3 h-3" />
              <span className="font-mono text-xs">{citations} sources</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            {status === "running" && <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />}
            {status === "complete" && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            {status === "error" && <AlertCircle className="w-3 h-3 text-red-400" />}
            <span className="font-mono text-xs text-white/40">{elapsedStr}</span>
          </div>
        </div>
      </div>

      {/* Thought stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[280px] max-h-[420px]"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(99,102,241,0.3) transparent" }}
      >
        {thoughts.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-10">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border border-indigo-500/30 flex items-center justify-center">
                <Brain className="w-5 h-5 text-indigo-400/60" />
              </div>
              <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-ping" />
            </div>
            <p className="font-mono text-xs text-white/30 text-center">
              Connecting to research stream…<br />
              First thoughts will appear shortly.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {thoughts.map((thought) => (
            <motion.div
              key={thought.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex gap-2.5 items-start"
            >
              <div className="mt-1.5 flex-shrink-0">
                {thought.type === "thought" && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                {thought.type === "progress" && <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />}
                {thought.type === "complete" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {thought.type === "error" && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
              </div>
              <p className={`font-mono text-xs leading-relaxed flex-1 ${
                thought.type === "thought" ? "text-white/70"
                : thought.type === "progress" ? "text-white/40 italic"
                : thought.type === "complete" ? "text-emerald-300"
                : "text-red-300"
              }`}>
                {thought.text}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>

        {status === "running" && (
          <div className="flex items-center gap-2 pl-4">
            <span className="font-mono text-xs text-indigo-400 animate-pulse">▊</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-2 border-t border-white/10 bg-white/5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-white/30">
            {status === "running" && `${thoughts.filter(t => t.type === "thought").length} thoughts captured`}
            {status === "complete" && "Research complete — knowledge graph will be updated"}
            {status === "error" && "Research encountered an error"}
            {status === "connecting" && "Establishing stream connection…"}
          </span>
          {status === "running" && (
            <div className="flex gap-0.5">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-1 h-3 rounded-full bg-indigo-500/60"
                  animate={{ scaleY: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
