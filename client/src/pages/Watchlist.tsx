import { trpc } from "@/lib/trpc";
import { Link, useParams, useLocation } from "wouter";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { Briefcase, ChevronRight, Plus, Trash2, Loader2, RefreshCw, Zap, ExternalLink, AlertTriangle } from "lucide-react";

const SENTIMENT_COLOR: Record<string, string> = {
  bullish: "oklch(0.72 0.18 145)",
  bearish: "oklch(0.65 0.20 25)",
  neutral: "oklch(0.65 0.02 265)",
  mixed: "oklch(0.85 0.20 75)",
};

export default function Watchlist() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || "0");
  const [, navigate] = useLocation();

  const { data: project } = trpc.projects.get.useQuery({ id: projectId }, { enabled: !!projectId });
  const { data: items, refetch: refetchItems } = trpc.watchlist.list.useQuery({ projectId }, { enabled: !!projectId });
  const { data: catalysts, refetch: refetchCatalysts } = trpc.finance.catalysts.useQuery({ projectId, limit: 30 }, { enabled: !!projectId });
  const { data: financeStatus } = trpc.finance.isConfigured.useQuery();

  const [newSymbol, setNewSymbol] = useState("");
  const [newAssetClass, setNewAssetClass] = useState<"equity" | "crypto" | "commodity" | "forex" | "index" | "rate">("equity");
  const [newSide, setNewSide] = useState<"long" | "short" | "watch">("watch");
  const [newThesis, setNewThesis] = useState("");

  const addMutation = trpc.watchlist.add.useMutation({
    onSuccess: () => { toast.success("Added"); refetchItems(); setNewSymbol(""); setNewThesis(""); },
    onError: (err) => toast.error(err.message),
  });

  const removeMutation = trpc.watchlist.remove.useMutation({
    onSuccess: () => { toast.success("Removed"); refetchItems(); },
    onError: (err) => toast.error(err.message),
  });

  const ingestMutation = trpc.finance.ingest.useMutation({
    onSuccess: (results) => {
      const total = results.reduce((s, r) => s + (r.inserted ?? 0), 0);
      toast.success(`Ingested ${total} new event${total === 1 ? "" : "s"}`);
      refetchCatalysts();
    },
    onError: (err) => toast.error(err.message),
  });

  const triggerSimMutation = trpc.finance.triggerSim.useMutation({
    onSuccess: (run) => {
      toast.success("Simulation started on latest catalysts");
      navigate(`/project/${projectId}/simulation/${run?.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="min-h-screen text-white" style={{ background: "oklch(0.05 0.01 265)" }}>
      <TopNav />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "oklch(0.55 0.02 265)" }}>
          <Link href="/" className="hover:text-white">Projects</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href={`/project/${projectId}`} className="hover:text-white">{project?.title ?? "Project"}</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-white">Watchlist & catalysts</span>
        </div>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-light flex items-center gap-3">
              <Briefcase className="w-8 h-8" style={{ color: "oklch(0.72 0.18 145)" }} />
              Watchlist & catalysts
            </h1>
            <p className="text-sm mt-2" style={{ color: "oklch(0.55 0.02 265)" }}>
              Track symbols. Ingest news. Auto-simulate stakeholder reactions to high-impact events.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => ingestMutation.mutate({ projectId })} disabled={ingestMutation.isPending || !items?.length}>
              {ingestMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Refresh news
            </Button>
            <Button onClick={() => triggerSimMutation.mutate({ projectId, totalRounds: 4 })} disabled={triggerSimMutation.isPending}>
              <Zap className="w-4 h-4 mr-2" /> Simulate now
            </Button>
          </div>
        </div>

        {!financeStatus?.configured && (
          <div className="mb-6 p-3 rounded-lg border flex items-start gap-2 text-sm"
               style={{ borderColor: "oklch(0.40 0.15 75 / 0.5)", background: "oklch(0.30 0.15 75 / 0.10)", color: "oklch(0.85 0.15 75)" }}>
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <strong>News ingest not configured.</strong> Add <code>POLYGON_API_KEY</code> (preferred) or <code>FINNHUB_API_KEY</code> in Manus to enable real-time catalyst detection. The watchlist still works as a manual symbol tracker meanwhile.
            </div>
          </div>
        )}

        {/* Add row */}
        <div className="rounded-lg border p-4 mb-8" style={{ background: "oklch(0.08 0.02 265 / 0.6)", borderColor: "oklch(0.20 0.05 265 / 0.5)" }}>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div className="md:col-span-1">
              <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "oklch(0.55 0.02 265)" }}>Symbol</label>
              <input value={newSymbol} onChange={(e) => setNewSymbol(e.target.value.toUpperCase())} placeholder="AAPL"
                     className="w-full bg-transparent border rounded px-3 py-2 font-mono" style={{ borderColor: "oklch(0.25 0.05 265)" }} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "oklch(0.55 0.02 265)" }}>Class</label>
              <select value={newAssetClass} onChange={(e) => setNewAssetClass(e.target.value as typeof newAssetClass)}
                      className="w-full bg-transparent border rounded px-3 py-2" style={{ borderColor: "oklch(0.25 0.05 265)" }}>
                <option value="equity">Equity</option>
                <option value="crypto">Crypto</option>
                <option value="commodity">Commodity</option>
                <option value="forex">FX</option>
                <option value="index">Index</option>
                <option value="rate">Rate</option>
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "oklch(0.55 0.02 265)" }}>Side</label>
              <select value={newSide} onChange={(e) => setNewSide(e.target.value as typeof newSide)}
                      className="w-full bg-transparent border rounded px-3 py-2" style={{ borderColor: "oklch(0.25 0.05 265)" }}>
                <option value="watch">Watch</option>
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "oklch(0.55 0.02 265)" }}>Thesis (optional)</label>
              <input value={newThesis} onChange={(e) => setNewThesis(e.target.value)} placeholder="why are you tracking this?"
                     className="w-full bg-transparent border rounded px-3 py-2" style={{ borderColor: "oklch(0.25 0.05 265)" }} />
            </div>
            <Button
              onClick={() => addMutation.mutate({ projectId, symbol: newSymbol, assetClass: newAssetClass, positionSide: newSide, thesis: newThesis || undefined })}
              disabled={!newSymbol.trim() || addMutation.isPending}
            >
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </div>

        {/* Symbol list */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-sm uppercase tracking-wider mb-3" style={{ color: "oklch(0.65 0.02 265)" }}>Tracked symbols</h2>
            <div className="space-y-2">
              {(items ?? []).length === 0 && <p className="text-sm" style={{ color: "oklch(0.50 0.02 265)" }}>Add a symbol above to start tracking.</p>}
              {items?.map((it) => (
                <div key={it.id} className="rounded border p-3 flex items-start justify-between"
                     style={{ background: "oklch(0.08 0.02 265 / 0.5)", borderColor: "oklch(0.20 0.05 265 / 0.5)" }}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold">{it.symbol}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "oklch(0.15 0.02 265)", color: "oklch(0.65 0.02 265)" }}>{it.assetClass}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded uppercase" style={{
                        background: it.positionSide === "long" ? "oklch(0.30 0.15 145 / 0.3)" : it.positionSide === "short" ? "oklch(0.30 0.15 25 / 0.3)" : "oklch(0.20 0.05 265)",
                        color: it.positionSide === "long" ? "oklch(0.85 0.18 145)" : it.positionSide === "short" ? "oklch(0.85 0.20 25)" : "oklch(0.75 0.02 265)",
                      }}>{it.positionSide}</span>
                    </div>
                    {it.thesis && <p className="text-xs mt-1" style={{ color: "oklch(0.65 0.02 265)" }}>{it.thesis}</p>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeMutation.mutate({ id: it.id })}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm uppercase tracking-wider mb-3" style={{ color: "oklch(0.65 0.02 265)" }}>Recent catalysts</h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {(catalysts ?? []).length === 0 && <p className="text-sm" style={{ color: "oklch(0.50 0.02 265)" }}>No catalysts yet. Click "Refresh news" once you've added symbols.</p>}
              {catalysts?.map((c) => (
                <div key={c.id} className="rounded border p-3"
                     style={{ background: "oklch(0.08 0.02 265 / 0.5)", borderColor: "oklch(0.20 0.05 265 / 0.5)" }}>
                  <div className="flex items-center gap-2 mb-1 text-xs">
                    <span className="font-mono font-bold">{c.symbol}</span>
                    <span style={{ color: "oklch(0.50 0.02 265)" }}>{c.publishedAt ? new Date(c.publishedAt).toLocaleString() : "—"}</span>
                    {c.sentiment && <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: `${SENTIMENT_COLOR[c.sentiment]} / 0.18`, color: SENTIMENT_COLOR[c.sentiment] }}>{c.sentiment}</span>}
                    <span className="ml-auto text-[10px]" style={{ color: c.importance && c.importance >= 70 ? "oklch(0.85 0.20 75)" : "oklch(0.55 0.02 265)" }}>
                      impact {c.importance ?? 0}
                    </span>
                  </div>
                  <div className="text-sm">{c.headline}</div>
                  {c.summary && <div className="text-xs mt-1" style={{ color: "oklch(0.65 0.02 265)" }}>{c.summary.slice(0, 240)}{c.summary.length > 240 ? "…" : ""}</div>}
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noreferrer" className="text-[10px] inline-flex items-center gap-0.5 mt-1.5" style={{ color: "oklch(0.55 0.20 200)" }}>
                      Source <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
