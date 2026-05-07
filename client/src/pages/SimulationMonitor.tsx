import { trpc } from "@/lib/trpc";
import { Link, useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { io, type Socket } from "socket.io-client";
import {
  ChevronRight, Activity, Square, FileText, Users,
  Twitter, MessageSquare, Zap, Clock, BarChart3, Brain,
  ArrowLeft, Cpu, Globe,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, LineChart, Line, ReferenceLine,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LogEntry {
  id: string;
  timestamp: string;
  type: "action" | "post" | "reply" | "system" | "round";
  agentName?: string;
  platform?: string;
  content: string;
  round?: number;
}

// ─── Agent Network Canvas ─────────────────────────────────────────────────────
// Renders a force-directed glow network of agents with live pulse animations
function AgentNetworkCanvas({ agents, activeAgentName, logs }: {
  agents: any[];
  activeAgentName: string | null;
  logs: LogEntry[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Array<{
    id: number; name: string; x: number; y: number; vx: number; vy: number;
    radius: number; color: string; pulsePhase: number; activity: number;
  }>>([]);
  const animRef = useRef<number>(0);

  // Assign a deterministic color per agent based on index
  const agentColors = useMemo(() => [
    "oklch(0.65 0.30 280)", "oklch(0.85 0.20 75)", "oklch(0.72 0.18 145)",
    "oklch(0.65 0.25 200)", "oklch(0.75 0.28 320)", "oklch(0.70 0.22 50)",
    "oklch(0.68 0.28 260)", "oklch(0.80 0.18 100)", "oklch(0.65 0.25 340)",
    "oklch(0.75 0.20 170)",
  ], []);

  // Boost activity counter when a log arrives for an agent
  useEffect(() => {
    if (logs.length === 0) return;
    const last = logs[logs.length - 1];
    if (!last.agentName) return;
    const node = nodesRef.current.find((n) => n.name === last.agentName);
    if (node) node.activity = Math.min(node.activity + 1, 10);
  }, [logs.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialise nodes
    if (agents.length > 0 && nodesRef.current.length !== agents.length) {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      const cx = W / 2;
      const cy = H / 2;
      nodesRef.current = agents.slice(0, 12).map((a, i) => {
        const angle = (i / Math.min(agents.length, 12)) * Math.PI * 2;
        const r = Math.min(W, H) * 0.32;
        return {
          id: a.id,
          name: a.name || `Agent ${i + 1}`,
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          radius: 8 + Math.random() * 4,
          color: agentColors[i % agentColors.length],
          pulsePhase: Math.random() * Math.PI * 2,
          activity: 0,
        };
      });
    }

    let t = 0;
    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      t += 0.016;

      ctx.clearRect(0, 0, W, H);

      // Background grid
      ctx.strokeStyle = "oklch(0.20 0.02 265 / 0.15)";
      ctx.lineWidth = 0.5;
      const gridSize = 40;
      for (let x = 0; x < W; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      const nodes = nodesRef.current;
      if (nodes.length === 0) {
        // Placeholder when no agents yet
        ctx.fillStyle = "oklch(0.35 0.02 265)";
        ctx.font = "12px JetBrains Mono, monospace";
        ctx.textAlign = "center";
        ctx.fillText("Awaiting agent data…", W / 2, H / 2);
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      // Force-directed: repel nodes from each other, attract to centre
      const cx = W / 2;
      const cy = H / 2;
      for (let i = 0; i < nodes.length; i++) {
        // Attraction to centre
        nodes[i].vx += (cx - nodes[i].x) * 0.0003;
        nodes[i].vy += (cy - nodes[i].y) * 0.0003;
        // Repulsion between nodes
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
          const force = 800 / (dist * dist);
          nodes[i].vx += (dx / dist) * force * 0.01;
          nodes[i].vy += (dy / dist) * force * 0.01;
          nodes[j].vx -= (dx / dist) * force * 0.01;
          nodes[j].vy -= (dy / dist) * force * 0.01;
        }
        // Damping
        nodes[i].vx *= 0.92;
        nodes[i].vy *= 0.92;
        nodes[i].x += nodes[i].vx;
        nodes[i].y += nodes[i].vy;
        // Boundary
        nodes[i].x = Math.max(20, Math.min(W - 20, nodes[i].x));
        nodes[i].y = Math.max(20, Math.min(H - 20, nodes[i].y));
        // Decay activity
        nodes[i].activity = Math.max(0, nodes[i].activity - 0.02);
      }

      // Draw edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200) {
            const alpha = (1 - dist / 200) * 0.25;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `oklch(0.55 0.28 280 / ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      nodes.forEach((node) => {
        const isActive = node.name === activeAgentName;
        const pulse = Math.sin(t * 2 + node.pulsePhase) * 0.5 + 0.5;
        const glowR = node.radius * (2.5 + pulse * 1.5 + node.activity * 0.5);
        const baseAlpha = 0.15 + node.activity * 0.08;

        // Outer glow
        const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR);
        grad.addColorStop(0, node.color.replace(")", ` / ${baseAlpha + (isActive ? 0.25 : 0)})`).replace("oklch(", "oklch("));
        grad.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Core circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color.replace(")", ` / ${0.75 + pulse * 0.25})`).replace("oklch(", "oklch(");
        ctx.fill();

        // Active ring
        if (isActive || node.activity > 2) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 4 + pulse * 3, 0, Math.PI * 2);
          ctx.strokeStyle = node.color.replace(")", ` / ${0.60 * pulse})`).replace("oklch(", "oklch(");
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Label
        ctx.fillStyle = "oklch(0.90 0.005 265)";
        ctx.font = `${isActive ? "bold " : ""}10px JetBrains Mono, monospace`;
        ctx.textAlign = "center";
        ctx.fillText(node.name.split(" ")[0].slice(0, 10), node.x, node.y + node.radius + 14);
      });

      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [agents, agentColors]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}

// ─── Log Terminal ─────────────────────────────────────────────────────────────
function LogTerminal({ logs }: { logs: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const typeColor: Record<string, string> = {
    action:  "oklch(0.65 0.30 280)",
    post:    "oklch(0.85 0.20 75)",
    reply:   "oklch(0.72 0.18 145)",
    system:  "oklch(0.55 0.02 265)",
    round:   "oklch(0.90 0.22 75)",
  };
  const typePrefix: Record<string, string> = {
    action: "ACT", post: "POST", reply: "RPLY", system: "SYS", round: "RND",
  };

  return (
    <div
      className="h-full overflow-y-auto font-jetbrains text-xs leading-relaxed p-3"
      style={{ background: "oklch(0.04 0.01 265)" }}
      onScroll={(e) => {
        const el = e.currentTarget;
        setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
      }}
    >
      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-[oklch(0.30_0.02_265)]">
          <Cpu className="w-8 h-8 opacity-30" />
          <p>Waiting for simulation events…</p>
        </div>
      ) : (
        logs.map((log) => (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15 }}
            className="flex gap-2 mb-0.5 hover:bg-[oklch(0.08_0.01_265)] rounded px-1 py-0.5 transition-colors"
          >
            <span className="text-[oklch(0.30_0.02_265)] shrink-0 w-[72px]">
              {new Date(log.timestamp).toLocaleTimeString("en", { hour12: false })}
            </span>
            <span
              className="shrink-0 w-10 font-bold"
              style={{ color: typeColor[log.type] || typeColor.system }}
            >
              [{typePrefix[log.type] || "LOG"}]
            </span>
            {log.agentName && (
              <span className="shrink-0 text-[oklch(0.65_0.30_280)] max-w-[80px] truncate">
                {log.agentName}:
              </span>
            )}
            <span className="text-[oklch(0.78_0.02_265)] break-all">{log.content}</span>
          </motion.div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}

// ─── Custom Tooltip for charts ────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[oklch(0.10_0.02_265)] border border-[oklch(0.25_0.04_265_/_0.50)] rounded-lg px-3 py-2 text-xs font-jetbrains">
      <p className="text-[oklch(0.60_0.02_265)] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SimulationMonitor() {
  const params = useParams<{ id: string; runId: string }>();
  const projectId = parseInt(params.id || "0");
  const runId = parseInt(params.runId || "0");
  const [, navigate] = useLocation();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeAgentName, setActiveAgentName] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: project } = trpc.projects.get.useQuery({ id: projectId }, { enabled: !!projectId });
  const { data: simulation, refetch: refetchSim } = trpc.simulations.get.useQuery({ id: runId }, { enabled: !!runId });
  const { data: agents } = trpc.agents.list.useQuery({ projectId }, { enabled: !!projectId });
  const { data: actions, refetch: refetchActions } = trpc.simulations.logs.useQuery(
    { simulationRunId: runId, limit: 500 }, { enabled: !!runId }
  );

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

  // Convert DB actions → log entries
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

  // Live updates via Socket.IO
  useEffect(() => {
    if (!runId) return;
    if (!socketRef.current) {
      socketRef.current = io({ path: "/api/socket.io" });
    }
    const sock = socketRef.current;
    sock.emit("join:simulation", runId);

    const onLog = (data: {
      round: number; agentName: string; platform: string;
      action: string; content: string; logLevel: string; timestamp: string;
    }) => {
      setActiveAgentName(data.agentName);
      setLogs((prev) => {
        const id = `live-${data.timestamp}-${data.agentName}-${prev.length}`;
        const type: LogEntry["type"] =
          data.action === "posted" ? "post" :
          data.action === "replied" ? "reply" :
          data.action === "observed" ? "system" : "action";
        return [...prev, { id, timestamp: data.timestamp, type, agentName: data.agentName, platform: data.platform, content: data.content, round: data.round }];
      });
    };
    const onStatus = (s: { status: string }) => {
      refetchSim();
      if (s.status === "completed" || s.status === "failed") refetchActions();
    };

    sock.on("log", onLog);
    sock.on("status", onStatus);

    if (simulation?.status === "running") {
      pollRef.current = setInterval(() => { refetchSim(); refetchActions(); }, 15000);
    }

    return () => {
      sock.emit("leave:simulation", runId);
      sock.off("log", onLog);
      sock.off("status", onStatus);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [runId, simulation?.status]);

  // ── Derived metrics ──────────────────────────────────────────────────────
  const progress = simulation
    ? Math.round(((simulation.currentRound || 0) / (simulation.totalRounds || 1)) * 100)
    : 0;

  const platformCounts = useMemo(() => ({
    twitter: logs.filter((l) => l.platform === "twitter").length,
    reddit:  logs.filter((l) => l.platform === "reddit").length,
    post:    logs.filter((l) => l.type === "post").length,
    reply:   logs.filter((l) => l.type === "reply").length,
    action:  logs.filter((l) => l.type === "action").length,
  }), [logs]);

  // Activity timeline: group by round
  const activityByRound = useMemo(() => {
    const map: Record<number, { round: number; posts: number; replies: number; actions: number }> = {};
    logs.forEach((l) => {
      const r = l.round || 0;
      if (!map[r]) map[r] = { round: r, posts: 0, replies: 0, actions: 0 };
      if (l.type === "post") map[r].posts++;
      else if (l.type === "reply") map[r].replies++;
      else if (l.type === "action") map[r].actions++;
    });
    return Object.values(map).sort((a, b) => a.round - b.round);
  }, [logs]);

  // Sentiment proxy: posts / (posts + replies) per round, scaled -1..1
  // More posts than replies = positive discourse; more replies = reactive/negative
  const sentimentByRound = useMemo(() => {
    return activityByRound.map((r) => {
      const total = r.posts + r.replies;
      if (total === 0) return { round: r.round, sentiment: 0 };
      // Normalise: pure posts = +1, pure replies = -1
      const raw = (r.posts - r.replies) / total;
      return { round: r.round, sentiment: parseFloat(raw.toFixed(2)) };
    });
  }, [activityByRound]);

  // Per-agent action counts
  const agentActivity = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach((l) => { if (l.agentName) map[l.agentName] = (map[l.agentName] || 0) + 1; });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name: name.split(" ")[0].slice(0, 10), count }));
  }, [logs]);

  const isLive = simulation?.status === "running";

  return (
    <div className="min-h-screen nebula-bg flex flex-col overflow-hidden">
      <TopNav />

      <div className="pt-16 flex flex-col flex-1 overflow-hidden">

        {/* ── Top header bar ───────────────────────────────────────────── */}
        <div className="glass-strong border-b border-[oklch(0.30_0.04_265_/_0.30)] px-4 sm:px-6 py-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-cormorant text-[oklch(0.55_0.02_265)] min-w-0">
              <Link href="/" className="hover:text-[oklch(0.65_0.30_280)] transition-colors shrink-0">Dashboard</Link>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <Link href={`/project/${projectId}`} className="hover:text-[oklch(0.65_0.30_280)] transition-colors truncate max-w-[120px]">
                {project?.title || "Project"}
              </Link>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <span className="text-[oklch(0.97_0.005_265)] shrink-0">Simulation #{runId}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Status pill */}
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-jetbrains ${
                isLive ? "status-running" :
                simulation?.status === "completed" ? "status-completed" :
                simulation?.status === "failed" ? "status-failed" : "status-pending"
              }`}>
                {isLive && <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.18_145)] mr-1.5 animate-pulse" />}
                {simulation?.status?.toUpperCase() || "PENDING"}
              </div>

              {isLive && (
                <Button
                  size="sm" variant="ghost"
                  onClick={() => stopMutation.mutate({ id: runId })}
                  className="font-cinzel text-xs tracking-wider text-[oklch(0.65_0.25_25)] hover:text-[oklch(0.75_0.25_25)] hover:bg-[oklch(0.65_0.25_25_/_0.10)] border border-[oklch(0.65_0.25_25_/_0.30)]"
                >
                  <Square className="w-3.5 h-3.5 mr-1.5" /> Stop
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
                  {generateReportMutation.isPending ? "Generating…" : "Generate Report"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── Main 3-column layout ─────────────────────────────────────── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_1fr_260px] overflow-hidden" style={{ height: "calc(100vh - 8rem)" }}>

          {/* ── LEFT PANEL: Stats + Agent list ───────────────────────── */}
          <div className="hidden lg:flex flex-col gap-4 p-4 border-r border-[oklch(0.20_0.02_265_/_0.40)] overflow-y-auto bg-[oklch(0.06_0.01_265_/_0.60)]">

            {/* Progress */}
            <div className="glass-card p-4">
              <div className="flex justify-between items-center mb-2">
                <p className="font-cinzel text-[9px] tracking-[0.2em] text-[oklch(0.50_0.02_265)]">PROGRESS</p>
                <span className="font-jetbrains text-xs text-[oklch(0.85_0.20_75)]">{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-[oklch(0.12_0.02_265)] overflow-hidden mb-2">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, oklch(0.55 0.28 280), oklch(0.85 0.20 75))",
                    boxShadow: "0 0 12px oklch(0.65 0.30 280 / 0.60)",
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
              <p className="font-jetbrains text-[10px] text-[oklch(0.45_0.02_265)]">
                Round {simulation?.currentRound || 0} / {simulation?.totalRounds || 0}
              </p>
            </div>

            {/* Key stats */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Events", value: logs.length, icon: Activity, color: "oklch(0.65 0.30 280)" },
                { label: "Agents", value: agents?.length || 0, icon: Users, color: "oklch(0.85 0.20 75)" },
                { label: "Posts", value: platformCounts.post, icon: Globe, color: "oklch(0.72 0.18 145)" },
                { label: "Replies", value: platformCounts.reply, icon: MessageSquare, color: "oklch(0.65 0.25 200)" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="glass-card p-3 flex flex-col gap-1">
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                  <p className="font-jetbrains text-lg font-bold text-[oklch(0.97_0.005_265)]">{value}</p>
                  <p className="font-cormorant text-[10px] text-[oklch(0.50_0.02_265)]">{label}</p>
                </div>
              ))}
            </div>

            {/* Agent list */}
            {agents && agents.length > 0 && (
              <div className="glass-card p-3 flex-1 min-h-0">
                <p className="font-cinzel text-[9px] tracking-[0.2em] text-[oklch(0.50_0.02_265)] mb-2">AGENTS</p>
                <div className="space-y-1 overflow-y-auto max-h-64">
                  {agents.slice(0, 12).map((agent: any, i: number) => {
                    const agentColors = [
                      "oklch(0.65 0.30 280)", "oklch(0.85 0.20 75)", "oklch(0.72 0.18 145)",
                      "oklch(0.65 0.25 200)", "oklch(0.75 0.28 320)", "oklch(0.70 0.22 50)",
                    ];
                    const color = agentColors[i % agentColors.length];
                    const isActive = agent.name === activeAgentName;
                    return (
                      <motion.div
                        key={agent.id}
                        animate={{ backgroundColor: isActive ? "oklch(0.55 0.28 280 / 0.12)" : "oklch(0.08 0.015 265 / 0.60)" }}
                        className="flex items-center gap-2 p-2 rounded-lg transition-colors"
                      >
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-cinzel shrink-0"
                          style={{ background: `${color.replace(")", " / 0.20)")}`, border: `1px solid ${color.replace(")", " / 0.35)")}`, color }}
                        >
                          {agent.name?.charAt(0) || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-cormorant text-xs text-[oklch(0.80_0.02_265)] truncate">{agent.name}</p>
                          <p className="font-jetbrains text-[9px] text-[oklch(0.40_0.02_265)] truncate">{agent.ideology || agent.role || "Agent"}</p>
                        </div>
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.18_145)] animate-pulse shrink-0" />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── CENTRE: Network canvas + Log terminal ────────────────── */}
          <div className="flex flex-col overflow-hidden">

            {/* Agent Network Visualisation */}
            <div
              className="shrink-0 relative border-b border-[oklch(0.20_0.02_265_/_0.40)]"
              style={{ height: "45%" }}
            >
              {/* Header overlay */}
              <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-[oklch(0.05_0.01_265_/_0.80)] to-transparent pointer-events-none">
                <div className="flex items-center gap-2">
                  <Brain className="w-3.5 h-3.5 text-[oklch(0.55_0.28_280_/_0.80)]" />
                  <span className="font-cinzel text-[9px] tracking-[0.2em] text-[oklch(0.55_0.02_265)]">AGENT NETWORK</span>
                </div>
                {activeAgentName && (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeAgentName}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="flex items-center gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.18_145)] animate-pulse" />
                      <span className="font-jetbrains text-[10px] text-[oklch(0.72_0.18_145)]">{activeAgentName}</span>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>

              <AgentNetworkCanvas
                agents={agents || []}
                activeAgentName={activeAgentName}
                logs={logs}
              />
            </div>

            {/* Log Terminal */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-[oklch(0.20_0.02_265_/_0.40)] bg-[oklch(0.05_0.01_265)] shrink-0">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[oklch(0.65_0.25_25_/_0.60)]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[oklch(0.85_0.20_75_/_0.60)]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[oklch(0.72_0.18_145_/_0.60)]" />
                  </div>
                  <span className="font-jetbrains text-[10px] text-[oklch(0.35_0.02_265)] ml-2">
                    oracle://simulation/{runId}/live
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {isLive && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.18_145)] animate-pulse" />
                      <span className="font-jetbrains text-[10px] text-[oklch(0.72_0.18_145)]">LIVE</span>
                    </div>
                  )}
                  <span className="font-jetbrains text-[10px] text-[oklch(0.35_0.02_265)]">
                    {logs.length} events
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <LogTerminal logs={logs} />
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL: Charts ───────────────────────────────────── */}
          <div className="hidden lg:flex flex-col gap-4 p-4 border-l border-[oklch(0.20_0.02_265_/_0.40)] overflow-y-auto bg-[oklch(0.06_0.01_265_/_0.60)]">

            {/* Activity Timeline */}
            <div className="glass-card p-3">
              <p className="font-cinzel text-[9px] tracking-[0.2em] text-[oklch(0.50_0.02_265)] mb-3">ACTIVITY TIMELINE</p>
              {activityByRound.length > 0 ? (
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={activityByRound} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradPosts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.65 0.30 280)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="oklch(0.65 0.30 280)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradReplies" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.85 0.20 75)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="oklch(0.85 0.20 75)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="round" tick={{ fontSize: 9, fill: "oklch(0.40 0.02 265)", fontFamily: "JetBrains Mono" }} />
                    <YAxis tick={{ fontSize: 9, fill: "oklch(0.40 0.02 265)", fontFamily: "JetBrains Mono" }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="posts" name="Posts" stroke="oklch(0.65 0.30 280)" fill="url(#gradPosts)" strokeWidth={1.5} dot={false} />
                    <Area type="monotone" dataKey="replies" name="Replies" stroke="oklch(0.85 0.20 75)" fill="url(#gradReplies)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[120px] flex items-center justify-center text-[oklch(0.30_0.02_265)] font-jetbrains text-xs">
                  No round data yet
                </div>
              )}
            </div>

            {/* Per-Agent Activity Bar Chart */}
            <div className="glass-card p-3">
              <p className="font-cinzel text-[9px] tracking-[0.2em] text-[oklch(0.50_0.02_265)] mb-3">AGENT ACTIVITY</p>
              {agentActivity.length > 0 ? (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={agentActivity} layout="vertical" margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 9, fill: "oklch(0.40 0.02 265)", fontFamily: "JetBrains Mono" }} />
                    <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 9, fill: "oklch(0.65 0.02 265)", fontFamily: "JetBrains Mono" }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Actions" radius={[0, 3, 3, 0]}>
                      {agentActivity.map((_, i) => (
                        <Cell
                          key={i}
                          fill={[
                            "oklch(0.65 0.30 280)", "oklch(0.85 0.20 75)", "oklch(0.72 0.18 145)",
                            "oklch(0.65 0.25 200)", "oklch(0.75 0.28 320)", "oklch(0.70 0.22 50)",
                            "oklch(0.68 0.28 260)", "oklch(0.80 0.18 100)",
                          ][i % 8]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[140px] flex items-center justify-center text-[oklch(0.30_0.02_265)] font-jetbrains text-xs">
                  No agent data yet
                </div>
              )}
            </div>

            {/* Platform breakdown */}
            <div className="glass-card p-3">
              <p className="font-cinzel text-[9px] tracking-[0.2em] text-[oklch(0.50_0.02_265)] mb-3">PLATFORM BREAKDOWN</p>
              <div className="space-y-2">
                {[
                  { label: "Twitter / X", value: platformCounts.twitter, color: "oklch(0.65 0.30 280)", icon: Twitter },
                  { label: "Reddit", value: platformCounts.reddit, color: "oklch(0.85 0.20 75)", icon: MessageSquare },
                ].map(({ label, value, color, icon: Icon }) => {
                  const total = platformCounts.twitter + platformCounts.reddit || 1;
                  const pct = Math.round((value / total) * 100);
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-3 h-3" style={{ color }} />
                          <span className="font-cormorant text-xs text-[oklch(0.65_0.02_265)]">{label}</span>
                        </div>
                        <span className="font-jetbrains text-xs" style={{ color }}>{value}</span>
                      </div>
                      <div className="h-1 rounded-full bg-[oklch(0.12_0.02_265)]">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: color, boxShadow: `0 0 6px ${color} / 0.50` }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sentiment Chart */}
            <div className="glass-card p-3">
              <p className="font-cinzel text-[9px] tracking-[0.2em] text-[oklch(0.50_0.02_265)] mb-3">DISCOURSE SENTIMENT</p>
              {sentimentByRound.length > 0 ? (
                <ResponsiveContainer width="100%" height={100}>
                  <LineChart data={sentimentByRound} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.72 0.18 145)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="oklch(0.72 0.18 145)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="round" tick={{ fontSize: 9, fill: "oklch(0.40 0.02 265)", fontFamily: "JetBrains Mono" }} />
                    <YAxis domain={[-1, 1]} tick={{ fontSize: 9, fill: "oklch(0.40 0.02 265)", fontFamily: "JetBrains Mono" }} />
                    <Tooltip content={<ChartTooltip />} />
                    <ReferenceLine y={0} stroke="oklch(0.30 0.02 265)" strokeDasharray="3 3" />
                    <Line
                      type="monotone" dataKey="sentiment" name="Sentiment"
                      stroke="oklch(0.72 0.18 145)" strokeWidth={2} dot={{ r: 3, fill: "oklch(0.72 0.18 145)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[100px] flex items-center justify-center text-[oklch(0.30_0.02_265)] font-jetbrains text-xs">
                  No sentiment data yet
                </div>
              )}
              <p className="font-jetbrains text-[9px] text-[oklch(0.35_0.02_265)] mt-1">
                +1 = constructive discourse · -1 = reactive discourse
              </p>
            </div>

            {/* Timing info */}
            <div className="glass-card p-3">
              <p className="font-cinzel text-[9px] tracking-[0.2em] text-[oklch(0.50_0.02_265)] mb-2">TIMING</p>
              <div className="space-y-1.5 font-jetbrains text-xs">
                {simulation?.startedAt && (
                  <div className="flex justify-between">
                    <span className="text-[oklch(0.45_0.02_265)]">Started</span>
                    <span className="text-[oklch(0.70_0.02_265)]">{new Date(simulation.startedAt).toLocaleTimeString()}</span>
                  </div>
                )}
                {simulation?.completedAt && (
                  <div className="flex justify-between">
                    <span className="text-[oklch(0.45_0.02_265)]">Completed</span>
                    <span className="text-[oklch(0.85_0.20_75)]">{new Date(simulation.completedAt).toLocaleTimeString()}</span>
                  </div>
                )}
                {simulation?.startedAt && !simulation?.completedAt && (
                  <div className="flex justify-between">
                    <span className="text-[oklch(0.45_0.02_265)]">Elapsed</span>
                    <span className="text-[oklch(0.72_0.18_145)]">
                      {Math.round((Date.now() - new Date(simulation.startedAt).getTime()) / 1000)}s
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
