import { trpc } from "@/lib/trpc";
import { Link, useParams } from "wouter";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Target, ChevronRight, CheckCircle2, AlertCircle, BarChart3 } from "lucide-react";

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.75 ? "oklch(0.72 0.18 145)" : value >= 0.5 ? "oklch(0.85 0.20 75)" : "oklch(0.65 0.20 25)";
  return (
    <span className="px-2 py-0.5 rounded text-xs font-mono" style={{ background: `${color} / 0.18`, color, border: `1px solid ${color}` }}>
      {pct}%
    </span>
  );
}

export default function Predictions() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || "0");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: project } = trpc.projects.get.useQuery({ id: projectId }, { enabled: !!projectId });
  const { data: predictions, refetch } = trpc.predictions.list.useQuery({ projectId }, { enabled: !!projectId });
  const { data: calibration } = trpc.predictions.calibration.useQuery({ projectId }, { enabled: !!projectId });

  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [groundTruth, setGroundTruth] = useState("");
  const [groundTruthSource, setGroundTruthSource] = useState("");
  const [occurred, setOccurred] = useState<boolean>(true);

  const resolveMutation = trpc.predictions.resolve.useMutation({
    onSuccess: (d) => {
      toast.success(`Resolved · Brier ${d.brier.toFixed(3)}`);
      refetch();
      setResolvingId(null);
      setGroundTruth("");
      setGroundTruthSource("");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="min-h-screen text-white" style={{ background: "oklch(0.05 0.01 265)" }}>
      <TopNav />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "oklch(0.55 0.02 265)" }}>
          <Link href="/" className="hover:text-white">Projects</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href={`/project/${projectId}`} className="hover:text-white">{project?.title ?? "Project"}</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-white">Predictions & calibration</span>
        </div>

        <h1 className="text-3xl font-light flex items-center gap-3 mb-2">
          <Target className="w-8 h-8" style={{ color: "oklch(0.72 0.18 145)" }} />
          Predictions
        </h1>
        <p className="text-sm mb-8" style={{ color: "oklch(0.55 0.02 265)" }}>
          Calibrated forecasts extracted from generated reports. {isAdmin ? "Resolve outcomes to score the model." : "Only admins can resolve outcomes."}
        </p>

        {calibration && calibration.total > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <div className="p-4 rounded-lg border" style={{ background: "oklch(0.08 0.02 265 / 0.6)", borderColor: "oklch(0.20 0.05 265 / 0.5)" }}>
              <div className="text-xs uppercase tracking-wider" style={{ color: "oklch(0.55 0.02 265)" }}>Total</div>
              <div className="text-2xl font-light">{calibration.total}</div>
            </div>
            <div className="p-4 rounded-lg border" style={{ background: "oklch(0.08 0.02 265 / 0.6)", borderColor: "oklch(0.20 0.05 265 / 0.5)" }}>
              <div className="text-xs uppercase tracking-wider" style={{ color: "oklch(0.55 0.02 265)" }}>Resolved</div>
              <div className="text-2xl font-light">{calibration.resolved}</div>
            </div>
            <div className="p-4 rounded-lg border" style={{ background: "oklch(0.08 0.02 265 / 0.6)", borderColor: "oklch(0.20 0.05 265 / 0.5)" }}>
              <div className="text-xs uppercase tracking-wider" style={{ color: "oklch(0.55 0.02 265)" }}>Mean confidence</div>
              <div className="text-2xl font-light">{Math.round(calibration.meanConfidence * 100)}%</div>
            </div>
            <div className="p-4 rounded-lg border" style={{ background: "oklch(0.08 0.02 265 / 0.6)", borderColor: "oklch(0.20 0.05 265 / 0.5)" }}>
              <div className="text-xs uppercase tracking-wider flex items-center gap-1" style={{ color: "oklch(0.55 0.02 265)" }}>
                <BarChart3 className="w-3 h-3" /> Mean Brier
              </div>
              <div className="text-2xl font-light">{calibration.meanBrier !== null ? calibration.meanBrier.toFixed(3) : "—"}</div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {(predictions ?? []).length === 0 ? (
            <p className="text-sm" style={{ color: "oklch(0.50 0.02 265)" }}>
              No predictions yet. They are extracted automatically from generated reports.
            </p>
          ) : (
            predictions!.map((p) => (
              <div key={p.id} className="p-4 rounded-lg border" style={{ background: "oklch(0.08 0.02 265 / 0.6)", borderColor: "oklch(0.20 0.05 265 / 0.5)" }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {p.resolvedAt
                        ? <CheckCircle2 className="w-4 h-4" style={{ color: "oklch(0.72 0.18 145)" }} />
                        : <AlertCircle className="w-4 h-4" style={{ color: "oklch(0.55 0.02 265)" }} />}
                      <span className="font-medium">{p.claim}</span>
                      <ConfidencePill value={p.confidence} />
                    </div>
                    <p className="text-sm mt-1" style={{ color: "oklch(0.75 0.02 265)" }}>{p.predictedOutcome}</p>
                    <div className="flex gap-4 text-xs mt-2" style={{ color: "oklch(0.55 0.02 265)" }}>
                      {p.confidenceBandLow !== null && p.confidenceBandHigh !== null && (
                        <span>80% CI: {Math.round((p.confidenceBandLow ?? 0) * 100)}–{Math.round((p.confidenceBandHigh ?? 0) * 100)}%</span>
                      )}
                      {p.horizonDays && <span>Horizon: {p.horizonDays}d</span>}
                      {p.resolvedAt && p.brierScore !== null && <span>Brier: {p.brierScore.toFixed(3)}</span>}
                    </div>
                    {p.groundTruth && (
                      <div className="mt-2 text-xs px-3 py-1.5 rounded" style={{ background: "oklch(0.06 0.02 265)", color: "oklch(0.80 0.02 265)" }}>
                        <strong>Outcome:</strong> {p.groundTruth}
                        {p.groundTruthSource && <span style={{ color: "oklch(0.50 0.02 265)" }}> · {p.groundTruthSource}</span>}
                      </div>
                    )}
                  </div>
                  {isAdmin && !p.resolvedAt && (
                    <Button size="sm" variant="ghost" onClick={() => setResolvingId(p.id === resolvingId ? null : p.id)}>
                      Resolve
                    </Button>
                  )}
                </div>

                {isAdmin && resolvingId === p.id && (
                  <div className="mt-4 pt-4 border-t grid gap-3" style={{ borderColor: "oklch(0.20 0.05 265)" }}>
                    <div>
                      <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "oklch(0.55 0.02 265)" }}>What actually happened</label>
                      <textarea
                        rows={2}
                        className="w-full bg-transparent border rounded px-3 py-2 text-sm"
                        style={{ borderColor: "oklch(0.25 0.05 265)" }}
                        value={groundTruth}
                        onChange={(e) => setGroundTruth(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "oklch(0.55 0.02 265)" }}>Source (optional)</label>
                        <input
                          className="w-full bg-transparent border rounded px-3 py-2 text-sm"
                          style={{ borderColor: "oklch(0.25 0.05 265)" }}
                          value={groundTruthSource}
                          onChange={(e) => setGroundTruthSource(e.target.value)}
                          placeholder="e.g. Reuters 2026-04-15"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "oklch(0.55 0.02 265)" }}>Outcome</label>
                        <select
                          className="w-full bg-transparent border rounded px-3 py-2 text-sm"
                          style={{ borderColor: "oklch(0.25 0.05 265)" }}
                          value={occurred ? "yes" : "no"}
                          onChange={(e) => setOccurred(e.target.value === "yes")}
                        >
                          <option value="yes">Occurred as predicted</option>
                          <option value="no">Did not occur</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={!groundTruth.trim() || resolveMutation.isPending}
                        onClick={() => resolveMutation.mutate({
                          id: p.id,
                          groundTruth: groundTruth.trim(),
                          groundTruthSource: groundTruthSource.trim() || undefined,
                          occurred,
                          confidence: p.confidence,
                        })}
                      >
                        Save resolution
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setResolvingId(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
