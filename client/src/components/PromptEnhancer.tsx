// PromptEnhancer.tsx
// AI-powered prompt enhancement component.
// Shows an "Enhance with AI" button next to the topic input. When clicked,
// calls research.enhancePrompt (Claude Opus → GPT-5 → Gemini 2.5 Pro) and
// presents a side-by-side diff of the original vs enhanced prompt.
// The user can accept, edit, or discard the enhancement.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Check, X, ChevronDown, ChevronUp, Loader2, Zap, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface PromptEnhancerProps {
  value: string;
  onChange: (value: string) => void;
  projectType?: string;
  disabled?: boolean;
}

const COMPLEXITY_COLORS: Record<string, string> = {
  low: "text-emerald-400",
  medium: "text-amber-400",
  high: "text-orange-400",
  very_high: "text-red-400",
};

export function PromptEnhancer({ value, onChange, projectType, disabled }: PromptEnhancerProps) {
  const [enhanced, setEnhanced] = useState<{
    enhancedPrompt: string;
    keyDimensions: string[];
    suggestedAgentTypes: string[];
    estimatedComplexity: string;
    rationale: string;
    provider: string;
    model: string;
  } | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const enhance = trpc.research.enhancePrompt.useMutation({
    onSuccess: (data) => {
      setEnhanced(data);
      setAccepted(false);
      setShowDetails(true);
    },
    onError: (err) => {
      toast.error(`Prompt enhancement failed: ${err.message}`);
    },
  });

  const handleEnhance = () => {
    if (!value.trim() || value.trim().length < 3) {
      toast.error("Please enter a topic first (at least 3 characters).");
      return;
    }
    setEnhanced(null);
    setAccepted(false);
    enhance.mutate({ rawTopic: value.trim(), projectType });
  };

  const handleAccept = () => {
    if (enhanced) {
      onChange(enhanced.enhancedPrompt);
      setAccepted(true);
      toast.success("Enhanced prompt applied.");
    }
  };

  const handleDiscard = () => {
    setEnhanced(null);
    setAccepted(false);
  };

  const isLoading = enhance.isPending;

  return (
    <div className="space-y-3">
      {/* Enhance button */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40 font-mono">
          {value.length > 0 ? `${value.length} chars` : "Enter a topic above"}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleEnhance}
          disabled={disabled || isLoading || !value.trim()}
          className="h-7 px-3 gap-1.5 border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 text-xs font-mono"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Enhancing…
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3" />
              Enhance with AI
            </>
          )}
        </Button>
      </div>

      {/* Enhancement result */}
      <AnimatePresence>
        {enhanced && !accepted && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="rounded-xl border border-indigo-500/30 bg-indigo-950/40 backdrop-blur-sm overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-indigo-500/20 bg-indigo-500/10">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-mono text-xs text-indigo-300 font-semibold">AI-Enhanced Prompt</span>
                <span className="font-mono text-xs text-white/30">
                  via {enhanced.model} ({enhanced.provider})
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowDetails(v => !v)}
                  className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                >
                  {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Enhanced prompt text */}
            <div className="px-4 py-3">
              <p className="text-sm text-white/80 leading-relaxed font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                {enhanced.enhancedPrompt}
              </p>
            </div>

            {/* Expandable details */}
            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-3 space-y-3 border-t border-indigo-500/20 pt-3">
                    {/* Rationale */}
                    {enhanced.rationale && (
                      <p className="font-mono text-xs text-white/40 italic">{enhanced.rationale}</p>
                    )}

                    {/* Complexity badge */}
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-white/30">Complexity:</span>
                      <span className={`font-mono text-xs font-semibold uppercase ${COMPLEXITY_COLORS[enhanced.estimatedComplexity] ?? "text-white/60"}`}>
                        {enhanced.estimatedComplexity.replace("_", " ")}
                      </span>
                    </div>

                    {/* Key dimensions */}
                    {enhanced.keyDimensions.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-mono text-xs text-white/30">Key research dimensions:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {enhanced.keyDimensions.map((d, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 font-mono text-xs text-white/60">
                              <Tag className="w-2.5 h-2.5" />
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested agent types */}
                    {enhanced.suggestedAgentTypes.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-mono text-xs text-white/30">Suggested agent archetypes:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {enhanced.suggestedAgentTypes.map((a, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 font-mono text-xs text-amber-300/70">
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action buttons */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-t border-indigo-500/20 bg-black/20">
              <Button
                type="button"
                size="sm"
                onClick={handleAccept}
                className="h-7 px-3 gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono"
              >
                <Check className="w-3 h-3" />
                Use Enhanced Prompt
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDiscard}
                className="h-7 px-3 gap-1.5 text-white/40 hover:text-white/70 text-xs font-mono"
              >
                <X className="w-3 h-3" />
                Keep Original
              </Button>
            </div>
          </motion.div>
        )}

        {accepted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono text-xs text-emerald-300">Enhanced prompt applied — ready for Deep Research.</span>
            <button
              onClick={() => { setAccepted(false); setEnhanced(null); }}
              className="ml-auto text-white/30 hover:text-white/60"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
