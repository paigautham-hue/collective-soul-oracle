import { trpc } from "@/lib/trpc";
import { Link, useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";
import { ChevronRight, FileText, Download, MessageSquare, Loader2, BarChart3 } from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import ShareManager from "@/components/ShareManager";

export default function ReportReader() {
  const params = useParams<{ id: string; reportId: string }>();
  const projectId = parseInt(params.id || "0");
  const reportId = parseInt(params.reportId || "0");
  const [, navigate] = useLocation();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: project } = trpc.projects.get.useQuery({ id: projectId }, { enabled: !!projectId });
  const { data: report, refetch } = trpc.reports.get.useQuery({ id: reportId }, { enabled: !!reportId });

  const exportPdfMutation = trpc.reports.exportPdf.useMutation({
    onSuccess: (d) => { toast.success("PDF ready"); window.open(d.url, "_blank"); },
    onError: (err) => toast.error(err.message),
  });
  const exportPptxMutation = trpc.reports.exportPptx.useMutation({
    onSuccess: (d) => { toast.success("PPTX ready"); window.open(d.url, "_blank"); },
    onError: (err) => toast.error(err.message),
  });

  // Poll while generating
  useEffect(() => {
    if (report?.status === "generating") {
      pollRef.current = setInterval(() => refetch(), 4000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [report?.status]);

  return (
    <div className="min-h-screen nebula-bg">
      <TopNav />
      <div className="pt-24 pb-16 container mx-auto px-4 sm:px-6 max-w-4xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-8 text-sm font-cormorant text-[oklch(0.55_0.02_265)]">
          <Link href="/" className="hover:text-[oklch(0.65_0.30_280)] transition-colors">Dashboard</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href={`/project/${projectId}`} className="hover:text-[oklch(0.65_0.30_280)] transition-colors">{project?.title || "Project"}</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[oklch(0.97_0.005_265)]">Report</span>
        </div>

        {!report ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 rounded-full border-2 border-[oklch(0.55_0.28_280_/_0.30)] border-t-[oklch(0.65_0.30_280)] animate-spin" />
          </div>
        ) : report.status === "generating" ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-12 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-[oklch(0.78_0.18_75_/_0.10)] border border-[oklch(0.78_0.18_75_/_0.25)] flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-8 h-8 text-[oklch(0.85_0.20_75)] animate-spin" />
            </div>
            <h2 className="font-cinzel text-xl font-semibold text-[oklch(0.97_0.005_265)] mb-3">
              Generating Report
            </h2>
            <p className="font-cormorant text-base text-[oklch(0.65_0.02_265)] max-w-md mx-auto">
              The AI Report Agent is analyzing simulation data, synthesizing insights, and composing your research report. This typically takes 2–5 minutes.
            </p>
            <div className="mt-8 flex justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-[oklch(0.85_0.20_75_/_0.60)] animate-bounce"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </motion.div>
        ) : report.status === "failed" ? (
          <div className="glass-card p-8 text-center">
            <p className="font-cinzel text-[oklch(0.65_0.25_25)]">Report generation failed</p>

          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Report Header */}
            <div className="glass-card p-8 mb-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[oklch(0.78_0.18_75_/_0.15)] border border-[oklch(0.78_0.18_75_/_0.25)] flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-[oklch(0.85_0.20_75)]" />
                    </div>
                    <div>
                      <span className="font-jetbrains text-[10px] tracking-[0.2em] text-[oklch(0.55_0.02_265)]">ANALYSIS REPORT</span>
                      <p className="font-jetbrains text-[10px] text-[oklch(0.45_0.02_265)]">
                        {new Date(report.createdAt).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <h1 className="font-cinzel text-2xl sm:text-3xl font-bold text-[oklch(0.97_0.005_265)] mb-2">
                    {report.title}
                  </h1>
                  {report.summary && (
                    <p className="font-cormorant text-base text-[oklch(0.70_0.02_265)] leading-relaxed italic">
                      {report.summary}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/project/${projectId}/chat`)}
                    className="font-cormorant text-sm text-[oklch(0.65_0.30_280)] hover:bg-[oklch(0.55_0.28_280_/_0.10)] border border-[oklch(0.55_0.28_280_/_0.25)]"
                  >
                    <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                    Chat with Agents
                  </Button>
                  <ShareManager projectId={projectId} reportId={reportId} />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => exportPdfMutation.mutate({ reportId })}
                    disabled={exportPdfMutation.isPending}
                    className="font-cormorant text-sm border border-[oklch(0.25_0.05_265)]"
                  >
                    Export PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => exportPptxMutation.mutate({ reportId })}
                    disabled={exportPptxMutation.isPending}
                    className="font-cormorant text-sm border border-[oklch(0.25_0.05_265)]"
                  >
                    Export PPTX
                  </Button>
                </div>
              </div>
            </div>

            {/* Report Content */}
            <div className="glass-card p-8 sm:p-10">
              <div
                className="prose prose-invert max-w-none"
                style={{
                  fontFamily: "Cormorant Garamond, serif",
                  fontSize: "1.0625rem",
                  lineHeight: "1.8",
                  color: "oklch(0.88 0.01 265)",
                }}
              >
                <style>{`
                  .report-content h1, .report-content h2, .report-content h3 {
                    font-family: 'Cinzel', serif;
                    color: oklch(0.97 0.005 265);
                    letter-spacing: 0.04em;
                    margin-top: 2em;
                    margin-bottom: 0.75em;
                  }
                  .report-content h1 { font-size: 1.5rem; }
                  .report-content h2 { font-size: 1.25rem; color: oklch(0.65 0.30 280); }
                  .report-content h3 { font-size: 1.1rem; color: oklch(0.85 0.20 75); }
                  .report-content p { margin-bottom: 1.25em; }
                  .report-content blockquote {
                    border-left: 3px solid oklch(0.55 0.28 280 / 0.50);
                    padding-left: 1.25em;
                    color: oklch(0.75 0.02 265);
                    font-style: italic;
                    margin: 1.5em 0;
                  }
                  .report-content ul, .report-content ol {
                    padding-left: 1.5em;
                    margin-bottom: 1.25em;
                  }
                  .report-content li { margin-bottom: 0.5em; }
                  .report-content code {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 0.85em;
                    background: oklch(0.13 0.025 265);
                    padding: 0.15em 0.4em;
                    border-radius: 0.25em;
                    color: oklch(0.85 0.20 75);
                  }
                  .report-content strong { color: oklch(0.97 0.005 265); font-weight: 600; }
                  .report-content hr {
                    border: none;
                    border-top: 1px solid oklch(0.25 0.03 265 / 0.40);
                    margin: 2em 0;
                  }
                `}</style>
                <div className="report-content">
                  <Streamdown>{report.content || ""}</Streamdown>
                </div>

                {/* Deep Research extras: visualizations + citations */}
                {(() => {
                  const meta = (report.metadata ?? {}) as { provenance?: string; model?: string; visualizations?: Array<{ type?: string; title?: string; caption?: string; data?: unknown }>; citations?: Array<{ url?: string; title?: string; snippet?: string }> };
                  const isDR = meta.provenance === "deep_research";
                  if (!isDR) return null;
                  return (
                    <div className="mt-8 pt-6 border-t" style={{ borderColor: "oklch(0.25 0.03 265 / 0.4)" }}>
                      <div className="flex items-center gap-2 mb-4 text-xs uppercase tracking-wider" style={{ color: "oklch(0.85 0.20 75)" }}>
                        <span>✦ Deep Research</span>
                        {meta.model && <span style={{ color: "oklch(0.55 0.02 265)" }}>· {meta.model}</span>}
                      </div>
                      {(meta.visualizations ?? []).length > 0 && (
                        <div className="space-y-4 mb-6">
                          <h3 className="font-cinzel text-sm tracking-wider" style={{ color: "oklch(0.65 0.30 280)" }}>VISUALIZATIONS</h3>
                          {meta.visualizations!.map((v, i) => (
                            <div key={i} className="p-4 rounded-lg border" style={{ background: "oklch(0.08 0.02 265 / 0.6)", borderColor: "oklch(0.20 0.05 265 / 0.5)" }}>
                              <div className="text-xs mb-1" style={{ color: "oklch(0.55 0.02 265)" }}>{v.type ?? "chart"}</div>
                              {v.title && <div className="font-medium text-sm mb-2">{v.title}</div>}
                              <pre className="text-[10px] overflow-x-auto" style={{ color: "oklch(0.70 0.02 265)" }}>{JSON.stringify(v.data, null, 2)}</pre>
                              {v.caption && <div className="text-xs mt-2" style={{ color: "oklch(0.65 0.02 265)" }}>{v.caption}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                      {(meta.citations ?? []).length > 0 && (
                        <div>
                          <h3 className="font-cinzel text-sm tracking-wider mb-3" style={{ color: "oklch(0.65 0.30 280)" }}>CITATIONS ({meta.citations!.length})</h3>
                          <ol className="space-y-1.5 text-xs">
                            {meta.citations!.map((c, i) => (
                              <li key={i}>
                                <span style={{ color: "oklch(0.55 0.02 265)" }}>{i + 1}.</span>{" "}
                                {c.url ? (
                                  <a href={c.url} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "oklch(0.55 0.20 200)" }}>
                                    {c.title || c.url}
                                  </a>
                                ) : (
                                  <span>{c.title}</span>
                                )}
                                {c.snippet && <div className="ml-4 mt-0.5" style={{ color: "oklch(0.55 0.02 265)" }}>{c.snippet.slice(0, 240)}</div>}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Metadata Footer */}
            <div className="mt-6 glass-card p-4 flex flex-wrap items-center gap-4 text-xs font-jetbrains text-[oklch(0.45_0.02_265)]">
              <span>Report ID: {report.id}</span>
              <span>·</span>
              <span>Project: {project?.title}</span>
              <span>·</span>
              <span>Generated: {new Date(report.createdAt).toLocaleString()}</span>

            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
