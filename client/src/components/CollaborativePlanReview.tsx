// CollaborativePlanReview.tsx
// Multi-turn Collaborative Planning modal for the Wizard Step 1.
// Flow: createPlan → user reviews plan → optionally refinePlan with feedback → executePlan
// This makes Oracle feel genuinely consultative and intelligent.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Map, RefreshCw, Play, X, ChevronRight, Loader2, Edit3, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface CollaborativePlanReviewProps {
  projectId: number;
  topic: string;
  onExecute: (interactionId: string) => void;
  onClose: () => void;
}

type Phase = "idle" | "creating" | "reviewing" | "refining" | "executing";

interface PlanSection {
  title: string;
  queries: string[];
}

function parsePlan(planText: string): PlanSection[] {
  // Try to parse structured plan sections from the AI response
  const sections: PlanSection[] = [];
  const lines = planText.split("\n").filter(l => l.trim());
  let current: PlanSection | null = null;

  for (const line of lines) {
    if (/^#+\s/.test(line) || /^\d+\.\s/.test(line) || /^[A-Z][^a-z]*:/.test(line)) {
      if (current) sections.push(current);
      current = { title: line.replace(/^#+\s|^\d+\.\s/, "").replace(/:$/, ""), queries: [] };
    } else if (current && line.trim().startsWith("-")) {
      current.queries.push(line.replace(/^-\s*/, "").trim());
    } else if (current && line.trim()) {
      current.queries.push(line.trim());
    }
  }
  if (current) sections.push(current);
  return sections.length > 0 ? sections : [{ title: "Research Plan", queries: [planText] }];
}

export function CollaborativePlanReview({ projectId, topic, onExecute, onClose }: CollaborativePlanReviewProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [planText, setPlanText] = useState("");
  const [interactionId, setInteractionId] = useState("");
  const [refinement, setRefinement] = useState("");
  const [showRefinement, setShowRefinement] = useState(false);

  const createPlan = trpc.research.createPlan.useMutation({
    onSuccess: (data) => {
      setPlanText(data.planText);
      setInteractionId(data.interactionId);
      setPhase("reviewing");
    },
    onError: (err) => {
      toast.error(`Failed to generate plan: ${err.message}`);
      setPhase("idle");
    },
  });

  const refinePlan = trpc.research.refinePlan.useMutation({
    onSuccess: (data) => {
      setPlanText(data.planText);
      setRefinement("");
      setShowRefinement(false);
      setPhase("reviewing");
    },
    onError: (err) => {
      toast.error(`Failed to refine plan: ${err.message}`);
      setPhase("reviewing");
    },
  });

  const executePlan = trpc.research.executePlan.useMutation({
    onSuccess: (_data) => {
      // executePlan returns summary/entities — signal completion to parent
      onExecute(interactionId);
    },
    onError: (err) => {
      toast.error(`Failed to start research: ${err.message}`);
      setPhase("reviewing");
    },
  });

  const handleCreate = () => {
    setPhase("creating");
    createPlan.mutate({ projectId, topic });
  };

  const handleRefine = () => {
    if (!refinement.trim()) return;
    setPhase("refining");
    refinePlan.mutate({ interactionId, feedback: refinement.trim() });
  };

  const handleExecute = () => {
    setPhase("executing");
    executePlan.mutate({ interactionId, projectId, topic });
  };

  const planSections = planText ? parsePlan(planText) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={phase === "idle" || phase === "reviewing" ? onClose : undefined}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-white/10 bg-[#080c14]/95 backdrop-blur-2xl overflow-hidden shadow-2xl shadow-indigo-950/50"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <Map className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white" style={{ fontFamily: "'Cinzel', serif" }}>
                Collaborative Research Plan
              </h3>
              <p className="text-xs text-white/40 font-mono mt-0.5">
                Review and refine before Oracle begins research
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={phase === "executing"}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors disabled:opacity-30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Topic */}
        <div className="px-6 py-3 border-b border-white/5 bg-white/5">
          <p className="font-mono text-xs text-white/40">Research topic:</p>
          <p className="text-sm text-white/80 mt-1 leading-relaxed" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            {topic}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <AnimatePresence mode="wait">
            {/* Idle state */}
            {phase === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-10 gap-4 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Map className="w-7 h-7 text-indigo-400/60" />
                </div>
                <div className="space-y-1">
                  <p className="text-white/70 text-sm" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                    Oracle will generate a structured research plan for your topic.
                  </p>
                  <p className="font-mono text-xs text-white/30">
                    You can review, refine, or approve before research begins.
                  </p>
                </div>
                <Button
                  onClick={handleCreate}
                  className="mt-2 gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-sm"
                >
                  <Map className="w-4 h-4" />
                  Generate Research Plan
                </Button>
              </motion.div>
            )}

            {/* Creating */}
            {phase === "creating" && (
              <motion.div
                key="creating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 gap-4"
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border border-indigo-500/30 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                  </div>
                  <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-ping" />
                </div>
                <p className="font-mono text-xs text-white/40">Generating research plan…</p>
              </motion.div>
            )}

            {/* Reviewing */}
            {(phase === "reviewing" || phase === "refining") && planText && (
              <motion.div
                key="reviewing"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Plan sections */}
                <div className="space-y-3">
                  {planSections.map((section, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-xl border border-white/10 bg-white/5 overflow-hidden"
                    >
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/5">
                        <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="font-mono text-xs text-white/70 font-semibold">{section.title}</span>
                      </div>
                      <ul className="px-4 py-3 space-y-1.5">
                        {section.queries.map((q, j) => (
                          <li key={j} className="flex items-start gap-2">
                            <div className="mt-1.5 w-1 h-1 rounded-full bg-amber-400/60 flex-shrink-0" />
                            <span className="text-xs text-white/60 leading-relaxed">{q}</span>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  ))}
                </div>

                {/* Refinement input */}
                <AnimatePresence>
                  {showRefinement && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2"
                    >
                      <Textarea
                        value={refinement}
                        onChange={e => setRefinement(e.target.value)}
                        placeholder="e.g. Focus more on geopolitical risks and less on technical factors. Add a section on central bank policies."
                        className="min-h-[80px] bg-white/5 border-white/10 text-white/80 placeholder:text-white/20 font-mono text-xs resize-none"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleRefine}
                          disabled={!refinement.trim() || phase === "refining"}
                          className="gap-1.5 bg-amber-600/80 hover:bg-amber-500/80 text-white font-mono text-xs h-7"
                        >
                          {phase === "refining" ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Refining…</>
                          ) : (
                            <><RefreshCw className="w-3 h-3" /> Apply Feedback</>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setShowRefinement(false); setRefinement(""); }}
                          className="font-mono text-xs h-7 text-white/40"
                        >
                          Cancel
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Executing */}
            {phase === "executing" && (
              <motion.div
                key="executing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12 gap-4"
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border border-emerald-500/30 flex items-center justify-center">
                    <Play className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="absolute inset-0 rounded-full border border-emerald-500/20 animate-ping" />
                </div>
                <p className="font-mono text-xs text-white/40">Launching Deep Research…</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer actions */}
        {(phase === "reviewing") && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRefinement(v => !v)}
              className="gap-1.5 border-white/20 text-white/60 hover:text-white font-mono text-xs h-8"
            >
              {showRefinement ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
              {showRefinement ? "Reviewing" : "Refine Plan"}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="font-mono text-xs h-8 text-white/40"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleExecute}
                className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs h-8"
              >
                <Play className="w-3.5 h-3.5" />
                Approve & Start Research
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
