import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link, useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  ChevronRight, Activity, Square, FileText, Users,
  Twitter, MessageSquare, Zap, Clock, BarChart3,
} from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: string;
  type: "action" | "post" | "reply" | "system" | "round";
  agentName?: string;
  platform?: string;
  content: string;
  round?: number;
}

function LogTerminal({ logs }: { logs: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const typeColor: Record<string, string> = {
    action: "oklch(0.65 0.30 280)",
    post: "oklch(0.85 0.20 75)",
    reply: "oklch(0.72 0.18 145)",
    system: "oklch(0.60 0.02 265)",
    round: "oklch(0.90 0.22 75)",
  };

  const typePrefix: Record<string, string> = {
    action: "ACT",
    post: "POST",
    reply: "RPLY",
    system: "SYS",
    round: "RND",
  };

  return (
    <div
      className="h-full overflow-y-auto font-jetbrains text-xs leading-relaxed p-4"
      style={{ background: "oklch(0.04 0.01 265)" }}
      onScroll={(e) => {
        const el = e.currentTarget;
        setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 50);
      }}
    >
      {logs.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-[oklch(0.35_0.02_265)]">Waiting for simulation events...</p>
        </div>
      ) : (
        logs.map((log) => (
          <div key={log.id} className="flex gap-3 mb-1 hover:bg-[oklch(0.08_0.01_265)] rounded px-1 py-0.5 transition-colors">
            <span className="text-[oklch(0.35_0.02_265)] shrink-0 w-20">
              {new Date(log.timestamp).toLocaleTimeString("en", { hour12: false })}
            </span>
            <span className="shrink-0 w-10 font-bold" style={{ color: typeColor[log.type] || typeColor.system }}>
              [{typePrefix[log.type] || "LOG"}]
            </span>
            {log.agentName && (
              <span className="shrink-0 text-[oklch(0.65_0.30_280)]">{log.agentName}:</span>
            )}
            <span className="text-[oklch(0.80_0.02_265)] break-all">{log.content}</span>
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}

export default function SimulationMonitor() {
  const params = useParams<{ id: string; runId: string }>();
  const projectId = parseInt(params.id || "0");
  const runId = parseInt(params.runId || "0");
  const [, navigate] = useLocation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: project } = trpc.projects.get.useQuery({ id: projectId }, { enabled: !!projectId });
  const { data: simulation, refetch: refetchSim } = trpc.simulations.get.useQuery({ id: runId }, { enabled: !!runId });
  const { data: agents } = trpc.agents.list.useQuery({ projectId }, { enabled: !!projectId });
  const { data: actions, refetch: refetchActions } = trpc.simulations.logs.useQuery({ simulationRunId: runId, limit: 200 }, { enabled: !!runId });

  const stopMutation = trpc.simulations.stop.useMutation({
    onSuccess: () => { toast.success("Simulation stopped"); refetchSim(); },
    onError: (err) => toast.error(err.message),
  });

  const generateReportMutation = trpc.reports.generate.useMutation({
    onSuccess: (report) => {
      toast.success("Report generation started");
      navigate(`/project/${projectId}/report/${report?.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  // Convert actions to log entries
  useEffect(() => {
    if (!actions) return;
    const newLogs: LogEntry[] = actions.map((a: any) => ({
      id: String(a.id),
      timestamp: a.createdAt,
      type: a.actionType as any,
      agentName: a.agentName,
      platform: a.platform,
      content: a.content || a.actionType,
      round: a.round,
    }));
    setLogs(newLogs);
  }, [actions]);

  // Poll for updates if simulation is running
  useEffect(() => {
    if (simulation?.status === "running") {
      pollRef.current = setInterval(() => {
        refetchSim();
        refetchActions();
      }, 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [simulation?.status]);

  const progress = simulation
    ? Math.round(((simulation.currentRound || 0) / (simulation.totalRounds || 1)) * 100)
    : 0;

  const platformCounts = actions
    ? {
        twitter: actions.filter((a: any) => a.platform === "twitter").length,
        reddit: actions.filter((a: any) => a.platform === "reddit").length,
      }
    : { twitter: 0, reddit: 0 };

  return (
    <div className="min-h-screen nebula-bg flex flex-col">
      <TopNav />
      <div className="pt-16 flex flex-col flex-1">
        {/* Header */}
        <div className="glass-strong border-b border-[oklch(0.30_0.04_265_/_0.30)] px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-cormorant text-[oklch(0.55_0.02_265)]">
                <Link href="/" className="hover:text-[oklch(0.65_0.30_280)] transition-colors">Dashboard</Link>
                <ChevronRight className="w-3 h-3" />
                <Link href={`/project/${projectId}`} className="hover:text-[oklch(0.65_0.30_280)] transition-colors">{project?.title || "Project"}</Link>
                <ChevronRight className="w-3 h-3" />
                <span className="text-[oklch(0.97_0.005_265)]">Simulation #{runId}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {simulation?.status === "running" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => stopMutation.mutate({ id: runId })}
                  className="font-cinzel text-xs tracking-wider text-[oklch(0.65_0.25_25)] hover:text-[oklch(0.65_0.25_25)] hover:bg-[oklch(0.65_0.25_25_/_0.10)] border border-[oklch(0.65_0.25_25_/_0.30)]"
                >
                  <Square className="w-3.5 h-3.5 mr-1.5" />
                  Stop
                </Button>
              )}
              {simulation?.status === "completed" && (
                <Button
                  size="sm"
                  onClick={() => generateReportMutation.mutate({ projectId, topic: project?.topic || project?.title || "Analysis", simulationRunId: runId })}
                  disabled={generateReportMutation.isPending}
                  className="font-cinzel text-xs tracking-wider bg-[oklch(0.78_0.18_75_/_0.80)] hover:bg-[oklch(0.78_0.18_75)] text-[oklch(0.04_0.01_265)] border border-[oklch(0.85_0.20_75_/_0.40)]"
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  Generate Report
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden" style={{ height: "calc(100vh - 8rem)" }}>
          {/* Left: Stats Panel */}
          <div className="w-full lg:w-72 glass-strong border-r border-[oklch(0.30_0.04_265_/_0.25)] p-4 overflow-y-auto shrink-0">
            {/* Status */}
            <div className="mb-4">
              <p className="font-cinzel text-[9px] tracking-[0.2em] text-[oklch(0.50_0.02_265)] mb-2">STATUS</p>
              <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-jetbrains ${
                simulation?.status === "running" ? "status-running" :
                simulation?.status === "completed" ? "status-completed" :
                simulation?.status === "failed" ? "status-failed" : "status-pending"
              }`}>
                {simulation?.status === "running" && <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.18_145)] mr-1.5 animate-pulse" />}
                {simulation?.status?.toUpperCase() || "PENDING"}
              </div>
            </div>

            {/* Progress */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <p className="font-cinzel text-[9px] tracking-[0.2em] text-[oklch(0.50_0.02_265)]">PROGRESS</p>
                <span className="font-jetbrains text-xs text-[oklch(0.65_0.30_280)]">{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[oklch(0.15_0.02_265)]">
                <motion.div
                  className="h-full rounded-full bg-[oklch(0.65_0.30_280)]"
                  style={{ boxShadow: "0 0 8px oklch(0.65 0.30 280 / 0.50)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <p className="font-jetbrains text-[10px] text-[oklch(0.45_0.02_265)] mt-1">
                Round {simulation?.currentRound || 0} / {simulation?.totalRounds || 0}
              </p>
            </div>

            {/* Stats */}
            <div className="space-y-3 mb-4">
              {[
                { label: "Total Actions", value: actions?.length || 0, icon: Activity },
                { label: "Active Agents", value: agents?.length || 0, icon: Users },
                { label: "Twitter Posts", value: platformCounts.twitter, icon: Twitter },
                { label: "Reddit Posts", value: platformCounts.reddit, icon: MessageSquare },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between p-3 rounded-xl bg-[oklch(0.08_0.015_265)] border border-[oklch(0.20_0.02_265_/_0.40)]">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-[oklch(0.55_0.28_280_/_0.70)]" />
                    <span className="font-cormorant text-sm text-[oklch(0.65_0.02_265)]">{label}</span>
                  </div>
                  <span className="font-jetbrains text-sm text-[oklch(0.97_0.005_265)]">{value}</span>
                </div>
              ))}
            </div>

            {/* Agent List */}
            {agents && agents.length > 0 && (
              <div>
                <p className="font-cinzel text-[9px] tracking-[0.2em] text-[oklch(0.50_0.02_265)] mb-2">AGENTS</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {agents.slice(0, 10).map((agent: any) => (
                    <div key={agent.id} className="flex items-center gap-2 p-2 rounded-lg bg-[oklch(0.08_0.015_265)]">
                      <div className="w-5 h-5 rounded-full bg-[oklch(0.55_0.28_280_/_0.20)] flex items-center justify-center text-[oklch(0.65_0.30_280)] text-[9px] font-cinzel shrink-0">
                        {agent.name?.charAt(0) || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-cormorant text-xs text-[oklch(0.80_0.02_265)] truncate">{agent.name}</p>
                        <p className="font-jetbrains text-[9px] text-[oklch(0.40_0.02_265)] truncate">{agent.ideology}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Log Terminal */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[oklch(0.20_0.02_265_/_0.40)] bg-[oklch(0.06_0.01_265)]">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[oklch(0.65_0.25_25_/_0.60)]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[oklch(0.85_0.20_75_/_0.60)]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[oklch(0.72_0.18_145_/_0.60)]" />
                </div>
                <span className="font-jetbrains text-[10px] text-[oklch(0.40_0.02_265)] ml-2">
                  oracle://simulation/{runId}/live
                </span>
              </div>
              <div className="flex items-center gap-2">
                {simulation?.status === "running" && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.18_145)] animate-pulse" />
                    <span className="font-jetbrains text-[10px] text-[oklch(0.72_0.18_145)]">LIVE</span>
                  </div>
                )}
                <span className="font-jetbrains text-[10px] text-[oklch(0.40_0.02_265)]">
                  {logs.length} events
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <LogTerminal logs={logs} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
