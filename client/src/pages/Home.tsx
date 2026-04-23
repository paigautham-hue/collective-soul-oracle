import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import TopNav from "@/components/TopNav";
import {
  Plus,
  Atom,
  Network,
  Activity,
  FileText,
  MessageSquare,
  ChevronRight,
  Sparkles,
  Brain,
  Zap,
  Globe,
  Clock,
  Users,
} from "lucide-react";
import { toast } from "sonner";

// ─── Particle Canvas ──────────────────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame: number;
    const particles: Array<{
      x: number; y: number; vx: number; vy: number;
      radius: number; alpha: number; color: string;
    }> = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const colors = [
      "oklch(0.65 0.30 280)",
      "oklch(0.72 0.32 280)",
      "oklch(0.85 0.20 75)",
      "oklch(0.55 0.28 280)",
    ];

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.6 + 0.1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `oklch(0.55 0.28 280 / ${(1 - dist / 120) * 0.15})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(")", ` / ${p.alpha})`).replace("oklch(", "oklch(");
        ctx.fill();

        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 3);
        grad.addColorStop(0, p.color.replace(")", ` / ${p.alpha * 0.4})`).replace("oklch(", "oklch("));
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fill();
      });

      animFrame = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.7 }}
    />
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "status-draft",
    building_graph: "status-pending",
    graph_ready: "status-completed",
    setting_up: "status-pending",
    ready: "status-completed",
    running: "status-running",
    completed: "status-completed",
    failed: "status-failed",
  };
  const labels: Record<string, string> = {
    draft: "Draft",
    building_graph: "Building Graph",
    graph_ready: "Graph Ready",
    setting_up: "Setting Up",
    ready: "Ready",
    running: "Running",
    completed: "Completed",
    failed: "Failed",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-jetbrains tracking-wider ${map[status] || "status-draft"}`}>
      {status === "running" && (
        <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.18_145)] mr-1.5 animate-pulse" />
      )}
      {labels[status] || status}
    </span>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, index }: { project: any; index: number }) {
  const statusIcons: Record<string, typeof Atom> = {
    draft: FileText,
    building_graph: Brain,
    graph_ready: Network,
    setting_up: Zap,
    ready: Sparkles,
    running: Activity,
    completed: Globe,
    failed: Zap,
  };
  const Icon = statusIcons[project.status] || Atom;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: "easeOut" }}
    >
      <Link href={`/project/${project.id}`}>
        <div className="glass-card p-6 cursor-pointer group relative overflow-hidden">
          {/* Hover glow */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, oklch(0.55 0.28 280 / 0.08) 0%, transparent 70%)" }} />

          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-[oklch(0.55_0.28_280_/_0.15)] border border-[oklch(0.55_0.28_280_/_0.25)] flex items-center justify-center group-hover:bg-[oklch(0.55_0.28_280_/_0.25)] transition-all duration-300">
              <Icon className="w-5 h-5 text-[oklch(0.65_0.30_280)]" />
            </div>
            <StatusBadge status={project.status} />
          </div>

          <h3 className="font-cinzel text-base font-semibold text-[oklch(0.97_0.005_265)] mb-2 line-clamp-1 group-hover:text-gradient-aurora transition-all duration-300">
            {project.title}
          </h3>

          {project.description && (
            <p className="font-cormorant text-sm text-[oklch(0.65_0.02_265)] line-clamp-2 mb-4 leading-relaxed">
              {project.description}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs font-jetbrains text-[oklch(0.50_0.02_265)]">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {project.agentCount} agents
            </span>
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              {project.roundCount} rounds
            </span>
            <span className="flex items-center gap-1 ml-auto">
              <Clock className="w-3 h-3" />
              {new Date(project.createdAt).toLocaleDateString()}
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-1.5">
              {project.graphBuilt && (
                <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.65_0.30_280)]" title="Graph built" />
              )}
              {project.envReady && (
                <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.85_0.20_75)]" title="Environment ready" />
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-[oklch(0.45_0.02_265)] group-hover:text-[oklch(0.65_0.30_280)] group-hover:translate-x-1 transition-all duration-200" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Create Project Modal ─────────────────────────────────────────────────────
function CreateProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<"twitter" | "reddit" | "both">("both");
  const [agentCount, setAgentCount] = useState(10);
  const [roundCount, setRoundCount] = useState(5);

  const createMutation = trpc.projects.create.useMutation({
    onSuccess: (project) => {
      toast.success("Project created successfully");
      onCreated();
      onClose();
      window.location.href = `/project/${project?.id}/wizard`;
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[oklch(0.04_0.01_265_/_0.85)] backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg glass-strong rounded-2xl p-8 border border-[oklch(0.35_0.05_265_/_0.40)]"
        style={{ background: "oklch(0.10 0.02 265 / 0.95)" }}
      >
        <div className="mb-6">
          <h2 className="font-cinzel text-xl font-semibold text-[oklch(0.97_0.005_265)] mb-1">
            New Simulation
          </h2>
          <p className="font-cormorant text-sm text-[oklch(0.60_0.02_265)]">
            Configure your multi-agent intelligence experiment
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block font-cinzel text-xs tracking-wider text-[oklch(0.65_0.30_280)] mb-2">
              PROJECT TITLE *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Climate Policy Discourse Analysis"
              className="w-full px-4 py-3 rounded-xl bg-[oklch(0.13_0.025_265)] border border-[oklch(0.30_0.04_265_/_0.40)] text-[oklch(0.97_0.005_265)] font-cormorant text-sm placeholder:text-[oklch(0.45_0.02_265)] focus:border-[oklch(0.55_0.28_280_/_0.60)] focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block font-cinzel text-xs tracking-wider text-[oklch(0.65_0.30_280)] mb-2">
              SIMULATION TOPIC
            </label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Impact of carbon tax on public opinion"
              className="w-full px-4 py-3 rounded-xl bg-[oklch(0.13_0.025_265)] border border-[oklch(0.30_0.04_265_/_0.40)] text-[oklch(0.97_0.005_265)] font-cormorant text-sm placeholder:text-[oklch(0.45_0.02_265)] focus:border-[oklch(0.55_0.28_280_/_0.60)] focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block font-cinzel text-xs tracking-wider text-[oklch(0.65_0.30_280)] mb-2">
              DESCRIPTION
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the research objective..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-[oklch(0.13_0.025_265)] border border-[oklch(0.30_0.04_265_/_0.40)] text-[oklch(0.97_0.005_265)] font-cormorant text-sm placeholder:text-[oklch(0.45_0.02_265)] focus:border-[oklch(0.55_0.28_280_/_0.60)] focus:outline-none transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-cinzel text-xs tracking-wider text-[oklch(0.65_0.30_280)] mb-2">
                PLATFORM
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
                className="w-full px-3 py-3 rounded-xl bg-[oklch(0.13_0.025_265)] border border-[oklch(0.30_0.04_265_/_0.40)] text-[oklch(0.97_0.005_265)] font-cormorant text-sm focus:border-[oklch(0.55_0.28_280_/_0.60)] focus:outline-none"
              >
                <option value="both">Both</option>
                <option value="twitter">Twitter</option>
                <option value="reddit">Reddit</option>
              </select>
            </div>
            <div>
              <label className="block font-cinzel text-xs tracking-wider text-[oklch(0.65_0.30_280)] mb-2">
                AGENTS
              </label>
              <input
                type="number"
                value={agentCount}
                onChange={(e) => setAgentCount(parseInt(e.target.value) || 10)}
                min={2}
                max={50}
                className="w-full px-3 py-3 rounded-xl bg-[oklch(0.13_0.025_265)] border border-[oklch(0.30_0.04_265_/_0.40)] text-[oklch(0.97_0.005_265)] font-cormorant text-sm focus:border-[oklch(0.55_0.28_280_/_0.60)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-cinzel text-xs tracking-wider text-[oklch(0.65_0.30_280)] mb-2">
                ROUNDS
              </label>
              <input
                type="number"
                value={roundCount}
                onChange={(e) => setRoundCount(parseInt(e.target.value) || 5)}
                min={1}
                max={20}
                className="w-full px-3 py-3 rounded-xl bg-[oklch(0.13_0.025_265)] border border-[oklch(0.30_0.04_265_/_0.40)] text-[oklch(0.97_0.005_265)] font-cormorant text-sm focus:border-[oklch(0.55_0.28_280_/_0.60)] focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1 font-cormorant text-[oklch(0.65_0.02_265)] hover:text-[oklch(0.97_0.005_265)] hover:bg-[oklch(0.15_0.02_265_/_0.50)]"
          >
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate({ title, description, topic, platform, agentCount, roundCount })}
            disabled={!title.trim() || createMutation.isPending}
            className="flex-1 font-cinzel text-xs tracking-wider bg-[oklch(0.55_0.28_280)] hover:bg-[oklch(0.60_0.30_280)] text-[oklch(0.97_0.005_265)] border border-[oklch(0.65_0.30_280_/_0.40)] glow-indigo disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating..." : "Create Project"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Home Page ───────────────────────────────────────────────────────────
export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const utils = trpc.useUtils();

  const { data: projects, isLoading: projectsLoading } = trpc.projects.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (loading) {
    return (
      <div className="min-h-screen nebula-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-[oklch(0.55_0.28_280_/_0.30)] border-t-[oklch(0.65_0.30_280)] animate-spin" />
          <p className="font-cinzel text-xs tracking-[0.2em] text-[oklch(0.55_0.02_265)]">INITIALIZING</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen nebula-bg relative overflow-hidden">
        <ParticleCanvas />
        <TopNav />

        {/* Hero */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-4">
          {/* Orbital rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[600px] h-[600px] rounded-full border border-[oklch(0.55_0.28_280_/_0.06)] animate-[spin_40s_linear_infinite]" />
            <div className="absolute w-[400px] h-[400px] rounded-full border border-[oklch(0.78_0.18_75_/_0.05)] animate-[spin_25s_linear_infinite_reverse]" />
            <div className="absolute w-[200px] h-[200px] rounded-full border border-[oklch(0.55_0.28_280_/_0.10)]" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative z-10 max-w-4xl"
          >
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-[oklch(0.55_0.28_280_/_0.25)] mb-8">
              <Sparkles className="w-3.5 h-3.5 text-[oklch(0.85_0.20_75)]" />
              <span className="font-jetbrains text-xs tracking-[0.15em] text-[oklch(0.75_0.02_265)]">
                MULTI-AGENT SWARM INTELLIGENCE
              </span>
            </div>

            {/* Main title */}
            <h1 className="font-cinzel text-5xl sm:text-6xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="text-gradient-aurora">The Collective</span>
              <br />
              <span className="text-[oklch(0.97_0.005_265)]">Soul</span>
              <span className="text-gradient-gold"> Oracle</span>
            </h1>

            <p className="font-cormorant text-xl sm:text-2xl text-[oklch(0.70_0.02_265)] max-w-2xl mx-auto mb-4 leading-relaxed">
              Simulate entire societies. Predict collective behavior. Decode the future of public opinion
              through AI-powered swarm intelligence.
            </p>

            <p className="font-cormorant text-base text-[oklch(0.55_0.02_265)] max-w-xl mx-auto mb-12">
              Upload seed documents. Build knowledge graphs. Deploy hundreds of AI agents.
              Watch emergent narratives unfold in real time.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href={getLoginUrl()}>
                <Button
                  size="lg"
                  className="font-cinzel text-sm tracking-wider px-8 py-6 bg-[oklch(0.55_0.28_280)] hover:bg-[oklch(0.60_0.30_280)] text-[oklch(0.97_0.005_265)] border border-[oklch(0.65_0.30_280_/_0.40)] glow-indigo transition-all duration-300 rounded-xl"
                >
                  <Atom className="w-4 h-4 mr-2" />
                  Begin Your Simulation
                </Button>
              </a>
              <Button
                variant="ghost"
                size="lg"
                className="font-cormorant text-lg text-[oklch(0.70_0.02_265)] hover:text-[oklch(0.97_0.005_265)] px-8 py-6"
                onClick={() => toast.info("Demo coming soon")}
              >
                Watch Demo
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="relative z-10 flex flex-wrap justify-center gap-3 mt-16"
          >
            {[
              { icon: Brain, label: "LLM-Powered Agents" },
              { icon: Network, label: "3D Knowledge Graphs" },
              { icon: Activity, label: "Real-Time Simulation" },
              { icon: FileText, label: "AI Research Reports" },
              { icon: MessageSquare, label: "Agent Conversations" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-4 py-2 rounded-full glass border border-[oklch(0.30_0.04_265_/_0.35)] text-[oklch(0.65_0.02_265)]"
              >
                <Icon className="w-3.5 h-3.5 text-[oklch(0.55_0.28_280_/_0.80)]" />
                <span className="font-cormorant text-sm">{label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    );
  }

  // Authenticated Dashboard
  return (
    <div className="min-h-screen nebula-bg relative">
      <ParticleCanvas />
      <TopNav />

      <div className="relative z-10 pt-24 pb-16 container mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10"
        >
          <div>
            <p className="font-jetbrains text-xs tracking-[0.2em] text-[oklch(0.55_0.28_280)] mb-2">
              WELCOME BACK
            </p>
            <h1 className="font-cinzel text-3xl sm:text-4xl font-bold text-[oklch(0.97_0.005_265)]">
              {projects && projects.length > 0 ? "Your Simulations" : "Begin Your Journey"}
            </h1>
            <p className="font-cormorant text-base text-[oklch(0.60_0.02_265)] mt-1">
              {user?.name || "Oracle"} — {projects?.length || 0} active project{projects?.length !== 1 ? "s" : ""}
            </p>
          </div>

          <Button
            onClick={() => setShowCreate(true)}
            className="font-cinzel text-xs tracking-wider px-6 py-5 bg-[oklch(0.55_0.28_280)] hover:bg-[oklch(0.60_0.30_280)] text-[oklch(0.97_0.005_265)] border border-[oklch(0.65_0.30_280_/_0.40)] glow-indigo transition-all duration-300 rounded-xl self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Simulation
          </Button>
        </motion.div>

        {/* Stats Bar */}
        {projects && projects.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10"
          >
            {[
              { label: "Total Projects", value: projects.length, icon: Atom, color: "oklch(0.65_0.30_280)" },
              { label: "Running", value: projects.filter((p) => p.status === "running").length, icon: Activity, color: "oklch(0.72_0.18_145)" },
              { label: "Completed", value: projects.filter((p) => p.status === "completed").length, icon: Globe, color: "oklch(0.85_0.20_75)" },
              { label: "Total Agents", value: projects.reduce((a, p) => a + (p.agentCount || 0), 0), icon: Users, color: "oklch(0.65_0.30_280)" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="glass-card p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color.replace("oklch(", "oklch(").replace(")", " / 0.15)")}`, border: `1px solid ${color.replace("oklch(", "oklch(").replace(")", " / 0.25)")}` }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <div>
                    <p className="font-cinzel text-xl font-bold text-[oklch(0.97_0.005_265)]">{value}</p>
                    <p className="font-cormorant text-xs text-[oklch(0.55_0.02_265)]">{label}</p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Projects Grid */}
        {projectsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="glass-card p-6 h-48 shimmer" />
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((project, i) => (
              <ProjectCard key={project.id} project={project} index={i} />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-[oklch(0.55_0.28_280_/_0.10)] border border-[oklch(0.55_0.28_280_/_0.20)] flex items-center justify-center mb-6 animate-float">
              <Atom className="w-10 h-10 text-[oklch(0.55_0.28_280_/_0.60)]" />
            </div>
            <h2 className="font-cinzel text-2xl font-semibold text-[oklch(0.97_0.005_265)] mb-3">
              No Simulations Yet
            </h2>
            <p className="font-cormorant text-base text-[oklch(0.60_0.02_265)] max-w-md mb-8">
              Create your first multi-agent simulation to begin exploring collective intelligence and emergent social dynamics.
            </p>
            <Button
              onClick={() => setShowCreate(true)}
              className="font-cinzel text-xs tracking-wider px-8 py-5 bg-[oklch(0.55_0.28_280)] hover:bg-[oklch(0.60_0.30_280)] text-[oklch(0.97_0.005_265)] border border-[oklch(0.65_0.30_280_/_0.40)] glow-indigo rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Simulation
            </Button>
          </motion.div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={() => utils.projects.list.invalidate()}
        />
      )}
    </div>
  );
}
