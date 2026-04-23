import { trpc } from "@/lib/trpc";
import { Link, useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { GitBranch, Plus, ArrowLeftRight, Loader2, ChevronRight } from "lucide-react";

interface PerturbationDraft {
  ideologyShift: string;
  removeAgentIds: string[];
  topicReframe: string;
}

export default function Branches() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || "0");
  const [, navigate] = useLocation();

  const { data: project } = trpc.projects.get.useQuery({ id: projectId }, { enabled: !!projectId });
  const { data: branches, refetch: refetchBranches } = trpc.branches.list.useQuery({ projectId }, { enabled: !!projectId });
  const { data: agents } = trpc.agents.list.useQuery({ projectId }, { enabled: !!projectId });
  const { data: runs } = trpc.simulations.list.useQuery({ projectId }, { enabled: !!projectId });

  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState("");
  const [perturbation, setPerturbation] = useState<PerturbationDraft>({ ideologyShift: "", removeAgentIds: [], topicReframe: "" });
  const [totalRounds, setTotalRounds] = useState(5);
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);

  const createMutation = trpc.branches.create.useMutation({
    onSuccess: (data) => {
      toast.success("Branch created — simulation running");
      refetchBranches();
      setShowCreate(false);
      setLabel("");
      setPerturbation({ ideologyShift: "", removeAgentIds: [], topicReframe: "" });
      if (data.simulationRunId) navigate(`/project/${projectId}/simulation/${data.simulationRunId}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const compareQuery = trpc.branches.compare.useQuery(
    { runIdA: compareA ?? 0, runIdB: compareB ?? 0 },
    { enabled: !!compareA && !!compareB }
  );

  const submit = () => {
    if (!label.trim()) { toast.error("Label required"); return; }
    const p: PerturbationDraft = {
      ideologyShift: perturbation.ideologyShift.trim(),
      removeAgentIds: perturbation.removeAgentIds,
      topicReframe: perturbation.topicReframe.trim(),
    };
    const cleaned: Partial<PerturbationDraft> = {};
    if (p.ideologyShift) cleaned.ideologyShift = p.ideologyShift;
    if (p.removeAgentIds.length > 0) cleaned.removeAgentIds = p.removeAgentIds;
    if (p.topicReframe) cleaned.topicReframe = p.topicReframe;
    createMutation.mutate({ projectId, label: label.trim(), totalRounds, perturbation: cleaned });
  };

  return (
    <div className="min-h-screen text-white" style={{ background: "oklch(0.05 0.01 265)" }}>
      <TopNav />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "oklch(0.55 0.02 265)" }}>
          <Link href="/" className="hover:text-white">Projects</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href={`/project/${projectId}`} className="hover:text-white">{project?.title ?? "Project"}</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-white">Counterfactual branches</span>
        </div>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-light flex items-center gap-3">
              <GitBranch className="w-8 h-8" style={{ color: "oklch(0.65 0.30 280)" }} />
              Counterfactual branches
            </h1>
            <p className="text-sm mt-2" style={{ color: "oklch(0.55 0.02 265)" }}>
              Run alternate simulations with perturbations and compare outcomes.
            </p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)}>
            <Plus className="w-4 h-4 mr-2" /> New branch
          </Button>
        </div>

        {showCreate && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 rounded-lg border"
            style={{ background: "oklch(0.10 0.02 265 / 0.6)", borderColor: "oklch(0.25 0.05 265 / 0.5)" }}
          >
            <h2 className="text-lg mb-4">Define perturbation</h2>
            <div className="grid gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "oklch(0.55 0.02 265)" }}>Branch label</label>
                <input
                  className="w-full bg-transparent border rounded px-3 py-2"
                  style={{ borderColor: "oklch(0.25 0.05 265)" }}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Without dominant influencer"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "oklch(0.55 0.02 265)" }}>Topic reframe (optional)</label>
                <input
                  className="w-full bg-transparent border rounded px-3 py-2"
                  style={{ borderColor: "oklch(0.25 0.05 265)" }}
                  value={perturbation.topicReframe}
                  onChange={(e) => setPerturbation({ ...perturbation, topicReframe: e.target.value })}
                  placeholder="e.g. assume regulation passes"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "oklch(0.55 0.02 265)" }}>Ideology shift (optional)</label>
                <input
                  className="w-full bg-transparent border rounded px-3 py-2"
                  style={{ borderColor: "oklch(0.25 0.05 265)" }}
                  value={perturbation.ideologyShift}
                  onChange={(e) => setPerturbation({ ...perturbation, ideologyShift: e.target.value })}
                  placeholder="e.g. shift agents 20% more skeptical"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: "oklch(0.55 0.02 265)" }}>Remove agents (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {agents?.map((a) => {
                    const removed = perturbation.removeAgentIds.includes(a.agentId);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setPerturbation({
                          ...perturbation,
                          removeAgentIds: removed
                            ? perturbation.removeAgentIds.filter((x) => x !== a.agentId)
                            : [...perturbation.removeAgentIds, a.agentId],
                        })}
                        className="px-3 py-1 text-xs rounded border transition-colors"
                        style={{
                          background: removed ? "oklch(0.30 0.20 25 / 0.3)" : "transparent",
                          borderColor: removed ? "oklch(0.55 0.20 25)" : "oklch(0.25 0.05 265)",
                          color: removed ? "oklch(0.85 0.15 25)" : "oklch(0.85 0.02 265)",
                        }}
                      >
                        {removed ? "✕ " : ""}{a.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "oklch(0.55 0.02 265)" }}>Rounds</label>
                <input
                  type="number" min={1} max={20}
                  className="w-32 bg-transparent border rounded px-3 py-2"
                  style={{ borderColor: "oklch(0.25 0.05 265)" }}
                  value={totalRounds}
                  onChange={(e) => setTotalRounds(parseInt(e.target.value || "5"))}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={submit} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Run branch
                </Button>
                <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid gap-3 mb-10">
          {(branches ?? []).length === 0 ? (
            <p className="text-sm" style={{ color: "oklch(0.50 0.02 265)" }}>No branches yet. Create one to explore counterfactuals.</p>
          ) : (
            branches!.map((b) => (
              <div key={b.id} className="p-4 rounded-lg border flex items-center justify-between"
                   style={{ background: "oklch(0.08 0.02 265 / 0.6)", borderColor: "oklch(0.20 0.05 265 / 0.5)" }}>
                <div>
                  <div className="font-medium">{b.label}</div>
                  <div className="text-xs mt-1" style={{ color: "oklch(0.55 0.02 265)" }}>
                    Run #{b.simulationRunId}
                    {b.parentRunId ? ` · forked from #${b.parentRunId}` : ""}
                    {b.perturbation && typeof b.perturbation === "object" ? ` · ${Object.keys(b.perturbation as Record<string, unknown>).join(", ")}` : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/project/${projectId}/simulation/${b.simulationRunId}`)}>
                    Monitor
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCompareA(b.simulationRunId)} className={compareA === b.simulationRunId ? "ring-1 ring-cyan-500" : ""}>
                    A
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCompareB(b.simulationRunId)} className={compareB === b.simulationRunId ? "ring-1 ring-cyan-500" : ""}>
                    B
                  </Button>
                </div>
              </div>
            ))
          )}
          {(runs ?? []).filter((r) => !branches?.some((b) => b.simulationRunId === r.id)).slice(0, 3).map((r) => (
            <div key={r.id} className="p-3 rounded-lg border flex items-center justify-between text-sm"
                 style={{ background: "oklch(0.06 0.02 265 / 0.4)", borderColor: "oklch(0.15 0.05 265 / 0.5)" }}>
              <span style={{ color: "oklch(0.65 0.02 265)" }}>Baseline run #{r.id} ({r.status})</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setCompareA(r.id)} className={compareA === r.id ? "ring-1 ring-cyan-500" : ""}>A</Button>
                <Button variant="ghost" size="sm" onClick={() => setCompareB(r.id)} className={compareB === r.id ? "ring-1 ring-cyan-500" : ""}>B</Button>
              </div>
            </div>
          ))}
        </div>

        {compareA && compareB && (
          <div className="rounded-lg border p-6" style={{ background: "oklch(0.08 0.02 265 / 0.6)", borderColor: "oklch(0.25 0.05 265 / 0.5)" }}>
            <h2 className="text-lg mb-4 flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5" /> Comparison: run #{compareA} vs run #{compareB}
            </h2>
            {compareQuery.isLoading && <p>Loading…</p>}
            {compareQuery.data && (
              <div className="grid grid-cols-2 gap-6">
                {(["a", "b"] as const).map((side) => {
                  const d = compareQuery.data![side];
                  return (
                    <div key={side}>
                      <h3 className="text-sm uppercase tracking-wider mb-2" style={{ color: "oklch(0.55 0.02 265)" }}>{side === "a" ? `Run #${compareA}` : `Run #${compareB}`}</h3>
                      <p className="text-xs mb-2">Total actions: <span className="text-white">{d.total}</span></p>
                      <p className="text-xs mb-1" style={{ color: "oklch(0.55 0.02 265)" }}>Actions:</p>
                      <ul className="text-xs space-y-0.5 mb-3">
                        {Object.entries(d.byAction).map(([k, v]) => (
                          <li key={k} className="flex justify-between"><span>{k}</span><span style={{ color: "oklch(0.65 0.30 280)" }}>{v as number}</span></li>
                        ))}
                      </ul>
                      <p className="text-xs mb-1" style={{ color: "oklch(0.55 0.02 265)" }}>Top agents:</p>
                      <ul className="text-xs space-y-0.5">
                        {Object.entries(d.byAgent).slice(0, 6).map(([k, v]) => (
                          <li key={k} className="flex justify-between"><span>{k}</span><span style={{ color: "oklch(0.85 0.20 75)" }}>{v as number}</span></li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
