import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link, useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState, useRef } from "react";
import {
  Upload, Brain, Users, Activity, FileText,
  ChevronRight, ChevronLeft, Check, Loader2,
  FileUp, X, Network, Sparkles,
} from "lucide-react";

const STEPS = [
  { id: 1, label: "Documents", icon: Upload, description: "Upload seed documents" },
  { id: 2, label: "Knowledge Graph", icon: Network, description: "Build ontology from documents" },
  { id: 3, label: "Agent Setup", icon: Users, description: "Generate agent personas" },
  { id: 4, label: "Simulation", icon: Activity, description: "Run the simulation" },
  { id: 5, label: "Report", icon: FileText, description: "Generate analysis report" },
];

export default function Wizard() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || "0");
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; text: string; url: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [graphBuilding, setGraphBuilding] = useState(false);
  const [agentsBuilding, setAgentsBuilding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: project, refetch: refetchProject } = trpc.projects.get.useQuery({ id: projectId }, { enabled: !!projectId });
  const { data: agents } = trpc.agents.list.useQuery({ projectId }, { enabled: !!projectId });
  const { data: graph } = trpc.graph.get.useQuery({ projectId }, { enabled: !!projectId && step >= 2 });

  const buildGraphMutation = trpc.graph.build.useMutation({
    onSuccess: (data) => {
      toast.success(`Knowledge graph built: ${data.nodes} nodes, ${data.edges} edges`);
      setGraphBuilding(false);
      refetchProject();
      setStep(3);
    },
    onError: (err) => { toast.error(err.message); setGraphBuilding(false); },
  });

  const generateAgentsMutation = trpc.graph.generateAgents.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.agentCount} agents created successfully`);
      setAgentsBuilding(false);
      refetchProject();
      setStep(4);
    },
    onError: (err) => { toast.error(err.message); setAgentsBuilding(false); },
  });

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

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("projectId", projectId.toString());
        const res = await fetch("/api/upload/document", { method: "POST", body: formData });
        const data = await res.json();
        if (data.success) {
          setUploadedFiles((prev) => [...prev, { name: file.name, text: data.fullText || "", url: data.storageUrl }]);
          toast.success(`${file.name} uploaded successfully`);
        } else {
          toast.error(data.error || "Upload failed");
        }
      } catch (err) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setIsUploading(false);
  };

  const handleBuildGraph = () => {
    const allText = uploadedFiles.map((f) => f.text).join("\n\n");
    if (!allText.trim()) {
      toast.error("No document text available for graph building");
      return;
    }
    setGraphBuilding(true);
    buildGraphMutation.mutate({ projectId, documentText: allText });
  };

  const handleGenerateAgents = () => {
    if (!project) return;
    setAgentsBuilding(true);
    generateAgentsMutation.mutate({
      projectId,
      topic: project.topic || project.title,
      agentCount: project.agentCount || 10,
      platform: project.platform || "both",
    });
  };

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
          <span className="text-[oklch(0.97_0.005_265)]">Setup Wizard</span>
        </div>

        {/* Step Progress */}
        <div className="glass-card p-6 mb-8">
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isDone = step > s.id;
              return (
                <div key={s.id} className="flex items-center">
                  <button
                    onClick={() => isDone && setStep(s.id)}
                    className={`flex flex-col items-center gap-2 min-w-[60px] ${isDone ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                      isDone
                        ? "bg-[oklch(0.55_0.28_280_/_0.25)] border-[oklch(0.65_0.30_280)] text-[oklch(0.65_0.30_280)]"
                        : isActive
                        ? "bg-[oklch(0.55_0.28_280_/_0.20)] border-[oklch(0.65_0.30_280)] text-[oklch(0.65_0.30_280)] pulse-indigo"
                        : "bg-[oklch(0.10_0.02_265)] border-[oklch(0.25_0.03_265)] text-[oklch(0.40_0.02_265)]"
                    }`}>
                      {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <span className={`font-cinzel text-[9px] tracking-wider text-center hidden sm:block ${
                      isActive ? "text-[oklch(0.65_0.30_280)]" : isDone ? "text-[oklch(0.55_0.28_280_/_0.70)]" : "text-[oklch(0.40_0.02_265)]"
                    }`}>
                      {s.label.toUpperCase()}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`w-8 sm:w-16 h-px mx-1 sm:mx-2 transition-all duration-500 ${step > s.id ? "bg-[oklch(0.55_0.28_280_/_0.50)]" : "bg-[oklch(0.20_0.02_265)]"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Step 1: Document Upload */}
            {step === 1 && (
              <div className="glass-card p-8">
                <div className="mb-6">
                  <h2 className="font-cinzel text-xl font-semibold text-[oklch(0.97_0.005_265)] mb-2">
                    Upload Seed Documents
                  </h2>
                  <p className="font-cormorant text-base text-[oklch(0.65_0.02_265)]">
                    Upload PDF, TXT, or DOCX files. The AI will extract knowledge and build an ontology graph from these documents.
                  </p>
                </div>

                {/* Drop Zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
                    isDragging
                      ? "border-[oklch(0.65_0.30_280)] bg-[oklch(0.55_0.28_280_/_0.10)]"
                      : "border-[oklch(0.30_0.04_265_/_0.50)] hover:border-[oklch(0.55_0.28_280_/_0.50)] hover:bg-[oklch(0.55_0.28_280_/_0.05)]"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.txt,.docx"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-10 h-10 text-[oklch(0.65_0.30_280)] animate-spin" />
                      <p className="font-cormorant text-base text-[oklch(0.65_0.02_265)]">Uploading...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <FileUp className="w-10 h-10 text-[oklch(0.55_0.28_280_/_0.60)]" />
                      <p className="font-cinzel text-sm text-[oklch(0.75_0.02_265)]">
                        Drop files here or click to browse
                      </p>
                      <p className="font-cormorant text-sm text-[oklch(0.50_0.02_265)]">
                        PDF, TXT, DOCX — up to 20MB each
                      </p>
                    </div>
                  )}
                </div>

                {/* Uploaded Files */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-6 space-y-2">
                    <p className="font-cinzel text-xs tracking-wider text-[oklch(0.65_0.30_280)] mb-3">UPLOADED FILES</p>
                    {uploadedFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[oklch(0.10_0.02_265_/_0.60)] border border-[oklch(0.25_0.03_265_/_0.30)]">
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-[oklch(0.65_0.30_280)]" />
                          <span className="font-cormorant text-sm text-[oklch(0.85_0.02_265)]">{f.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-[oklch(0.72_0.18_145)]" />
                          <button onClick={(e) => { e.stopPropagation(); setUploadedFiles((prev) => prev.filter((_, j) => j !== i)); }}>
                            <X className="w-4 h-4 text-[oklch(0.50_0.02_265)] hover:text-[oklch(0.65_0.25_25)] transition-colors" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end mt-8">
                  <Button
                    onClick={() => setStep(2)}
                    disabled={uploadedFiles.length === 0}
                    className="font-cinzel text-xs tracking-wider px-8 py-5 bg-[oklch(0.55_0.28_280)] hover:bg-[oklch(0.60_0.30_280)] text-[oklch(0.97_0.005_265)] border border-[oklch(0.65_0.30_280_/_0.40)] glow-indigo disabled:opacity-40 rounded-xl"
                  >
                    Continue to Graph Building
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Graph Building */}
            {step === 2 && (
              <div className="glass-card p-8">
                <div className="mb-6">
                  <h2 className="font-cinzel text-xl font-semibold text-[oklch(0.97_0.005_265)] mb-2">
                    Build Knowledge Graph
                  </h2>
                  <p className="font-cormorant text-base text-[oklch(0.65_0.02_265)]">
                    The AI will analyze your documents and extract entities, relationships, and concepts to build a structured knowledge graph.
                  </p>
                </div>

                <div className="rounded-2xl bg-[oklch(0.10_0.02_265_/_0.60)] border border-[oklch(0.25_0.03_265_/_0.30)] p-6 mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Brain className="w-5 h-5 text-[oklch(0.65_0.30_280)]" />
                    <span className="font-cinzel text-sm text-[oklch(0.97_0.005_265)]">AI Graph Extraction</span>
                  </div>
                  <div className="space-y-2 font-cormorant text-sm text-[oklch(0.65_0.02_265)]">
                    <p>• Extract 15–30 key entities (people, organizations, concepts, events)</p>
                    <p>• Map relationships between entities with semantic labels</p>
                    <p>• Assign entity types and descriptions for visualization</p>
                    <p>• Generate 3D coordinates for the force-directed graph</p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-[oklch(0.25_0.03_265_/_0.25)]">
                    <p className="font-jetbrains text-xs text-[oklch(0.50_0.02_265)]">
                      Documents ready: {uploadedFiles.length} file{uploadedFiles.length !== 1 ? "s" : ""} · {uploadedFiles.reduce((a, f) => a + f.text.length, 0).toLocaleString()} characters
                    </p>
                  </div>
                </div>

                {project?.graphBuilt && graph && (
                  <div className="rounded-2xl bg-[oklch(0.55_0.28_280_/_0.08)] border border-[oklch(0.55_0.28_280_/_0.25)] p-4 mb-6">
                    <div className="flex items-center gap-2 text-[oklch(0.65_0.30_280)]">
                      <Check className="w-4 h-4" />
                      <span className="font-cormorant text-sm">Graph already built: {graph.nodes.length} nodes, {graph.edges.length} edges</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between mt-8">
                  <Button variant="ghost" onClick={() => setStep(1)} className="font-cormorant text-[oklch(0.65_0.02_265)] hover:text-[oklch(0.97_0.005_265)]">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <div className="flex gap-3">
                    {project?.graphBuilt && (
                      <Button variant="ghost" onClick={() => setStep(3)} className="font-cormorant text-[oklch(0.65_0.30_280)]">
                        Skip (already built) <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                    <Button
                      onClick={handleBuildGraph}
                      disabled={graphBuilding || uploadedFiles.length === 0}
                      className="font-cinzel text-xs tracking-wider px-8 py-5 bg-[oklch(0.55_0.28_280)] hover:bg-[oklch(0.60_0.30_280)] text-[oklch(0.97_0.005_265)] border border-[oklch(0.65_0.30_280_/_0.40)] glow-indigo disabled:opacity-40 rounded-xl"
                    >
                      {graphBuilding ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Building Graph...</>
                      ) : (
                        <><Sparkles className="w-4 h-4 mr-2" /> Build Knowledge Graph</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Agent Setup */}
            {step === 3 && (
              <div className="glass-card p-8">
                <div className="mb-6">
                  <h2 className="font-cinzel text-xl font-semibold text-[oklch(0.97_0.005_265)] mb-2">
                    Generate Agent Personas
                  </h2>
                  <p className="font-cormorant text-base text-[oklch(0.65_0.02_265)]">
                    The AI will create {project?.agentCount || 10} diverse, realistic social media personas with unique ideologies, personalities, and demographics.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  {[
                    { label: "Agents to Create", value: project?.agentCount || 10, icon: Users },
                    { label: "Platform", value: project?.platform?.toUpperCase() || "BOTH", icon: Activity },
                    { label: "Topic", value: project?.topic || project?.title || "—", icon: Brain },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="rounded-xl bg-[oklch(0.10_0.02_265_/_0.60)] border border-[oklch(0.25_0.03_265_/_0.30)] p-4">
                      <Icon className="w-4 h-4 text-[oklch(0.65_0.30_280)] mb-2" />
                      <p className="font-cinzel text-xs tracking-wider text-[oklch(0.50_0.02_265)] mb-1">{label.toUpperCase()}</p>
                      <p className="font-cormorant text-sm text-[oklch(0.97_0.005_265)] truncate">{value}</p>
                    </div>
                  ))}
                </div>

                {project?.envReady && agents && agents.length > 0 && (
                  <div className="rounded-2xl bg-[oklch(0.55_0.28_280_/_0.08)] border border-[oklch(0.55_0.28_280_/_0.25)] p-4 mb-6">
                    <div className="flex items-center gap-2 text-[oklch(0.65_0.30_280)] mb-3">
                      <Check className="w-4 h-4" />
                      <span className="font-cormorant text-sm">{agents.length} agents already created</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {agents.slice(0, 6).map((agent) => (
                        <div key={agent.id} className="flex items-center gap-2 p-2 rounded-lg bg-[oklch(0.10_0.02_265_/_0.60)]">
                          <div className="w-6 h-6 rounded-full bg-[oklch(0.55_0.28_280_/_0.20)] flex items-center justify-center text-[oklch(0.65_0.30_280)] text-xs font-cinzel">
                            {agent.name.charAt(0)}
                          </div>
                          <span className="font-cormorant text-xs text-[oklch(0.75_0.02_265)] truncate">{agent.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between mt-8">
                  <Button variant="ghost" onClick={() => setStep(2)} className="font-cormorant text-[oklch(0.65_0.02_265)] hover:text-[oklch(0.97_0.005_265)]">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <div className="flex gap-3">
                    {project?.envReady && (
                      <Button variant="ghost" onClick={() => setStep(4)} className="font-cormorant text-[oklch(0.65_0.30_280)]">
                        Skip (already done) <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                    <Button
                      onClick={handleGenerateAgents}
                      disabled={agentsBuilding}
                      className="font-cinzel text-xs tracking-wider px-8 py-5 bg-[oklch(0.55_0.28_280)] hover:bg-[oklch(0.60_0.30_280)] text-[oklch(0.97_0.005_265)] border border-[oklch(0.65_0.30_280_/_0.40)] glow-indigo disabled:opacity-40 rounded-xl"
                    >
                      {agentsBuilding ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating Agents...</>
                      ) : (
                        <><Users className="w-4 h-4 mr-2" /> Generate Agents</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Simulation */}
            {step === 4 && (
              <div className="glass-card p-8">
                <div className="mb-6">
                  <h2 className="font-cinzel text-xl font-semibold text-[oklch(0.97_0.005_265)] mb-2">
                    Launch Simulation
                  </h2>
                  <p className="font-cormorant text-base text-[oklch(0.65_0.02_265)]">
                    Deploy your agents into the simulation environment. They will interact, post, and respond across {project?.roundCount || 5} rounds.
                  </p>
                </div>

                <div className="rounded-2xl bg-[oklch(0.10_0.02_265_/_0.60)] border border-[oklch(0.25_0.03_265_/_0.30)] p-6 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Agents", value: agents?.length || project?.agentCount || 0 },
                      { label: "Rounds", value: project?.roundCount || 5 },
                      { label: "Platform", value: project?.platform?.toUpperCase() || "BOTH" },
                      { label: "Topic", value: project?.topic || "—" },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="font-cinzel text-xs tracking-wider text-[oklch(0.50_0.02_265)] mb-1">{label.toUpperCase()}</p>
                        <p className="font-cormorant text-base text-[oklch(0.97_0.005_265)] truncate">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between mt-8">
                  <Button variant="ghost" onClick={() => setStep(3)} className="font-cormorant text-[oklch(0.65_0.02_265)] hover:text-[oklch(0.97_0.005_265)]">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button
                    onClick={() => startSimMutation.mutate({ projectId, totalRounds: project?.roundCount || 5, platform: project?.platform || "both" })}
                    disabled={startSimMutation.isPending || !project?.envReady}
                    className="font-cinzel text-xs tracking-wider px-8 py-5 bg-[oklch(0.72_0.18_145_/_0.80)] hover:bg-[oklch(0.72_0.18_145)] text-[oklch(0.97_0.005_265)] border border-[oklch(0.72_0.18_145_/_0.40)] disabled:opacity-40 rounded-xl"
                  >
                    {startSimMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting...</>
                    ) : (
                      <><Activity className="w-4 h-4 mr-2" /> Launch Simulation</>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5: Report */}
            {step === 5 && (
              <div className="glass-card p-8">
                <div className="mb-6">
                  <h2 className="font-cinzel text-xl font-semibold text-[oklch(0.97_0.005_265)] mb-2">
                    Generate Analysis Report
                  </h2>
                  <p className="font-cormorant text-base text-[oklch(0.65_0.02_265)]">
                    The AI Report Agent will analyze simulation data and generate a comprehensive research report with predictions and insights.
                  </p>
                </div>

                <div className="flex justify-between mt-8">
                  <Button variant="ghost" onClick={() => setStep(4)} className="font-cormorant text-[oklch(0.65_0.02_265)] hover:text-[oklch(0.97_0.005_265)]">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button
                    onClick={() => generateReportMutation.mutate({ projectId, topic: project?.topic || project?.title || "Simulation Analysis" })}
                    disabled={generateReportMutation.isPending}
                    className="font-cinzel text-xs tracking-wider px-8 py-5 bg-[oklch(0.78_0.18_75_/_0.80)] hover:bg-[oklch(0.78_0.18_75)] text-[oklch(0.04_0.01_265)] border border-[oklch(0.85_0.20_75_/_0.40)] disabled:opacity-40 rounded-xl"
                  >
                    {generateReportMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                    ) : (
                      <><FileText className="w-4 h-4 mr-2" /> Generate Report</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
