import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link, useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft, Network, Activity, FileText, MessageSquare,
  Play, ChevronRight, Brain, Zap, Globe, Users, Clock,
  Layers, BarChart3, Wand2, GitBranch, Target, Loader2, Eraser,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "status-draft", building_graph: "status-pending", graph_ready: "status-completed",
    setting_up: "status-pending", ready: "status-completed", running: "status-running",
    completed: "status-completed", failed: "status-failed",
  };
  const labels: Record<string, string> = {
    draft: "Draft", building_graph: "Building Graph", graph_ready: "Graph Ready",
    setting_up: "Setting Up", ready: "Ready", running: "Running",
    completed: "Completed", failed: "Failed",
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-jetbrains tracking-wider ${map[status] || "status-draft"}`}>
      {status === "running" && <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.18_145)] mr-1.5 animate-pulse" />}
      {labels[status] || status}
    </span>
  );
}

export default function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || "0");
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  const { data: project, isLoading } = trpc.projects.get.useQuery({ id: projectId }, { enabled: !!projectId });
  const { data: agents } = trpc.agents.list.useQuery({ projectId }, { enabled: !!projectId });
  const { data: simulations } = trpc.simulations.list.useQuery({ projectId }, { enabled: !!projectId });
  const { data: reports } = trpc.reports.list.useQuery({ projectId }, { enabled: !!projectId });

  const startSimMutation = trpc.simulations.start.useMutation({
    onSuccess: (run) => {
      toast.success("Simulation started");
      navigate(`/project/${projectId}/simulation/${run?.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const generateReportMutation = trpc.reports.generate.useMutation({
    onSuccess: (report) => {
      toast.success("Report generation started");
      navigate(`/project/${projectId}/report/${report?.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const resetMemoryMutation = trpc.simulations.resetMemory.useMutation({
    onSuccess: (d) => toast.success(`Wiped ${d.deleted} memory entr${d.deleted === 1 ? "y" : "ies"} \u2014 next run will be blank-slate`),
    onError: (err) => toast.error(err.message),
  });

  if (!isAuthenticated) {
    return <div className="min-h-screen nebula-bg flex items-center justify-center">
      <p className="font-cormorant text-[oklch(0.60_0.02_265)]">Please sign in to view this project.</p>
    </div>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen nebula-bg flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-[oklch(0.55_0.28_280_/_0.30)] border-t-[oklch(0.65_0.30_280)] animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen nebula-bg flex flex-col items-center justify-center gap-4">
        <p className="font-cinzel text-[oklch(0.97_0.005_265)]">Project not found</p>
        <Link href="/"><Button variant="ghost" className="font-cormorant text-[oklch(0.65_0.30_280)]">← Back to Dashboard</Button></Link>
      </div>
    );
  }

  const latestSim = simulations?.[0];
  const canRunSim = project.envReady || project.status === "ready" || project.status === "completed";
  const simIsLive = latestSim?.status === "running" || latestSim?.status === "pending";
  const canStartNew = canRunSim && !simIsLive;
  const canGenerateReport = simulations && simulations.length > 0;

  const actions = [
    {
      icon: Wand2,
      label: "Setup Wizard",
      description: "Configure agents, graph, and environment",
      href: `/project/${projectId}/wizard`,
      color: "oklch(0.65_0.30_280)",
      available: true,
    },
    {
      icon: Network,
      label: "Knowledge Graph",
      description: `${project.graphBuilt ? "Explore the built ontology" : "Graph not yet built"}`,
      href: `/project/${projectId}/graph`,
      color: "oklch(0.65_0.30_280)",
      available: project.graphBuilt,
    },
    {
      icon: Activity,
      label: simIsLive ? "Monitor Live Simulation" : latestSim ? "Run Simulation Again" : "Run Simulation",
      description: !canRunSim
        ? "Complete setup first"
        : simIsLive
          ? "A simulation is currently running"
          : latestSim
            ? `Last run: ${latestSim.status}. Click to start a fresh run with current agents & memory.`
            : "Launch multi-agent simulation",
      href: simIsLive && latestSim ? `/project/${projectId}/simulation/${latestSim.id}` : "#",
      color: "oklch(0.72_0.18_145)",
      available: canRunSim,
      action: canStartNew
        ? () => startSimMutation.mutate({ projectId, totalRounds: project.roundCount || 5, platform: project.platform || "both" })
        : undefined,
    },
    {
      icon: FileText,
      label: "Analysis Report",
      description: canGenerateReport ? "Generate AI research report" : "Run simulation first",
      href: reports?.[0] ? `/project/${projectId}/report/${reports[0].id}` : "#",
      color: "oklch(0.85_0.20_75)",
      available: canGenerateReport,
      action: canGenerateReport && !reports?.[0] ? () => generateReportMutation.mutate({ projectId, topic: project.topic || project.title, simulationRunId: latestSim?.id }) : undefined,
    },
    {
      icon: MessageSquare,
      label: "Agent Chat",
      description: agents && agents.length > 0 ? `Chat with ${agents.length} agents` : "Agents not yet created",
      href: `/project/${projectId}/chat`,
      color: "oklch(0.65_0.30_280)",
      available: agents && agents.length > 0,
    },
    {
      icon: GitBranch,
      label: "Counterfactual Branches",
      description: simulations && simulations.length > 0 ? "Run alternate simulations & compare" : "Run baseline simulation first",
      href: `/project/${projectId}/branches`,
      color: "oklch(0.65_0.20_200)",
      available: simulations && simulations.length > 0,
    },
    {
      icon: Target,
      label: "Predictions & Calibration",
      description: reports && reports.length > 0 ? "Calibrated forecasts from reports" : "Generate a report first",
      href: `/project/${projectId}/predictions`,
      color: "oklch(0.72_0.18_145)",
      available: reports && reports.length > 0,
    },
  ];

  return (
    <div className="min-h-screen nebula-bg">
      <TopNav />
      <div className="pt-24 pb-16 container mx-auto px-4 sm:px-6">
        {/* Breadcrumb */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 mb-8 text-sm font-cormorant text-[oklch(0.55_0.02_265)]"
        >
          <Link href="/" className="hover:text-[oklch(0.65_0.30_280)] transition-colors">Dashboard</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[oklch(0.97_0.005_265)]">{project.title}</span>
        </motion.div>

        {/* Project Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <StatusBadge status={project.status} />
                <span className="font-jetbrains text-xs text-[oklch(0.45_0.02_265)]">
                  {project.platform?.toUpperCase()} · {project.agentCount} AGENTS · {project.roundCount} ROUNDS
                </span>
              </div>
              <h1 className="font-cinzel text-2xl sm:text-3xl font-bold text-[oklch(0.97_0.005_265)] mb-2">
                {project.title}
              </h1>
              {project.topic && (
                <p className="font-cormorant text-base text-[oklch(0.65_0.30_280)] mb-2 italic">
                  "{project.topic}"
                </p>
              )}
              {project.description && (
                <p className="font-cormorant text-base text-[oklch(0.65_0.02_265)] leading-relaxed">
                  {project.description}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Link href={`/project/${projectId}/wizard`}>
                <Button
                  size="sm"
                  className="font-cinzel text-xs tracking-wider bg-[oklch(0.55_0.28_280)] hover:bg-[oklch(0.60_0.30_280)] text-[oklch(0.97_0.005_265)] border border-[oklch(0.65_0.30_280_/_0.40)] glow-indigo"
                >
                  <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                  Open Wizard
                </Button>
              </Link>
            </div>
          </div>

          {/* Progress indicators */}
          <div className="flex items-center gap-6 mt-6 pt-6 border-t border-[oklch(0.30_0.04_265_/_0.25)]">
            {[
              { label: "Documents", done: true, icon: FileText },
              { label: "Graph Built", done: project.graphBuilt, icon: Network },
              { label: "Agents Ready", done: project.envReady, icon: Users },
              { label: "Simulation", done: simulations && simulations.length > 0, icon: Activity },
              { label: "Report", done: reports && reports.some(r => r.status === "completed"), icon: BarChart3 },
            ].map(({ label, done, icon: Icon }, i) => (
              <div key={label} className="flex items-center gap-2">
                {i > 0 && <div className={`w-8 h-px ${done ? "bg-[oklch(0.55_0.28_280_/_0.50)]" : "bg-[oklch(0.25_0.02_265)]"}`} />}
                <div className={`flex items-center gap-1.5 ${done ? "text-[oklch(0.65_0.30_280)]" : "text-[oklch(0.40_0.02_265)]"}`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span className="font-jetbrains text-[10px] tracking-wider hidden sm:block">{label.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {actions.map(({ icon: Icon, label, description, href, color, available, action }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              {action ? (
                <button
                  onClick={action}
                  disabled={!available || startSimMutation.isPending || generateReportMutation.isPending}
                  className={`w-full text-left glass-card p-6 group ${!available ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <ActionCardContent icon={Icon} label={label} description={description} color={color} available={available} />
                </button>
              ) : (
                <Link href={available ? href : "#"}>
                  <div className={`glass-card p-6 group ${!available ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
                    <ActionCardContent icon={Icon} label={label} description={description} color={color} available={available} />
                  </div>
                </Link>
              )}
            </motion.div>
          ))}
        </div>

        {/* Recent Activity */}
        {simulations && simulations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-cinzel text-sm font-semibold tracking-wider text-[oklch(0.65_0.30_280)]">
                SIMULATION HISTORY
              </h2>
              <div className="flex items-center gap-2">
                {canStartNew && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={startSimMutation.isPending}
                    onClick={() => startSimMutation.mutate({ projectId, totalRounds: project.roundCount || 5, platform: project.platform || "both" })}
                    className="font-cormorant text-xs border border-[oklch(0.25_0.05_265)]"
                  >
                    {startSimMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                    Run again
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={resetMemoryMutation.isPending || simIsLive}
                      className="font-cormorant text-xs border border-[oklch(0.30_0.15_25_/_0.40)] text-[oklch(0.75_0.18_25)] hover:bg-[oklch(0.30_0.15_25_/_0.10)]"
                      title={simIsLive ? "Cannot reset while a simulation is running" : "Wipe all agent memories for a blank-slate re-run"}
                    >
                      {resetMemoryMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Eraser className="w-3 h-3 mr-1" />}
                      Reset memory
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset agent memory?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently deletes every observation, action, reflection, and fact your agents have accumulated for this project. The next simulation run will start blank-slate. Past simulation logs and reports are kept untouched.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => resetMemoryMutation.mutate({ projectId })}
                        className="bg-[oklch(0.55_0.20_25)] hover:bg-[oklch(0.50_0.22_25)]"
                      >
                        Wipe memory
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            <div className="space-y-3">
              {simulations.slice(0, 5).map((sim) => (
                <Link key={sim.id} href={`/project/${projectId}/simulation/${sim.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[oklch(0.10_0.02_265_/_0.50)] hover:bg-[oklch(0.13_0.025_265_/_0.60)] border border-[oklch(0.25_0.03_265_/_0.30)] transition-all cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <Activity className="w-4 h-4 text-[oklch(0.55_0.28_280_/_0.70)]" />
                      <div>
                        <p className="font-cormorant text-sm text-[oklch(0.97_0.005_265)]">
                          Simulation #{sim.id} — Round {sim.currentRound}/{sim.totalRounds}
                        </p>
                        <p className="font-jetbrains text-xs text-[oklch(0.50_0.02_265)]">
                          {new Date(sim.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-jetbrains ${
                        sim.status === "running" ? "status-running" :
                        sim.status === "completed" ? "status-completed" :
                        sim.status === "failed" ? "status-failed" : "status-pending"
                      }`}>
                        {sim.status === "running" && <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.18_145)] mr-1.5 animate-pulse" />}
                        {sim.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[oklch(0.40_0.02_265)] group-hover:text-[oklch(0.65_0.30_280)] transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function ActionCardContent({ icon: Icon, label, description, color, available }: any) {
  return (
    <>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110"
        style={{ background: `${color.replace("oklch(", "oklch(").replace(")", " / 0.15)")}`, border: `1px solid ${color.replace("oklch(", "oklch(").replace(")", " / 0.25)")}` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <h3 className="font-cinzel text-sm font-semibold text-[oklch(0.97_0.005_265)] mb-1.5">{label}</h3>
      <p className="font-cormorant text-sm text-[oklch(0.60_0.02_265)] leading-relaxed">{description}</p>
      {available && (
        <div className="mt-4 flex items-center gap-1 text-xs font-jetbrains" style={{ color }}>
          Open <ChevronRight className="w-3 h-3" />
        </div>
      )}
    </>
  );
}
