import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, X, Network, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface GraphNode {
  id: string;
  label: string;
  type: string;
  description?: string;
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
}
interface GraphEdge {
  source: string;
  target: string;
  label?: string;
}

const NODE_COLORS: Record<string, string> = {
  person: "#7c6af5",
  organization: "#f5a623",
  concept: "#4ecdc4",
  event: "#e74c3c",
  location: "#2ecc71",
  default: "#8b8bff",
};

function ForceGraph({ nodes, edges, onNodeClick }: { nodes: GraphNode[]; edges: GraphEdge[]; onNodeClick: (n: GraphNode) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{ nodes: GraphNode[]; edges: GraphEdge[]; scale: number; offsetX: number; offsetY: number; dragging: boolean; lastX: number; lastY: number; animFrame: number }>({
    nodes: [], edges: [], scale: 1, offsetX: 0, offsetY: 0, dragging: false, lastX: 0, lastY: 0, animFrame: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialize node positions
    const w = canvas.width;
    const h = canvas.height;
    const simNodes: GraphNode[] = nodes.map((n, i) => ({
      ...n,
      x: n.x !== undefined ? n.x * (w / 2) + w / 2 : Math.random() * w,
      y: n.y !== undefined ? n.y * (h / 2) + h / 2 : Math.random() * h,
      vx: 0,
      vy: 0,
    }));
    stateRef.current.nodes = simNodes;
    stateRef.current.edges = edges;

    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

    const simulate = () => {
      const s = stateRef.current;
      const ns = s.nodes;

      // Repulsion
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[i].x! - ns[j].x!;
          const dy = ns[i].y! - ns[j].y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 4000 / (dist * dist);
          ns[i].vx! += (dx / dist) * force;
          ns[i].vy! += (dy / dist) * force;
          ns[j].vx! -= (dx / dist) * force;
          ns[j].vy! -= (dy / dist) * force;
        }
      }

      // Attraction along edges
      for (const e of s.edges) {
        const src = nodeMap.get(e.source);
        const tgt = nodeMap.get(e.target);
        if (!src || !tgt) continue;
        const dx = tgt.x! - src.x!;
        const dy = tgt.y! - src.y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 120) * 0.02;
        src.vx! += (dx / dist) * force;
        src.vy! += (dy / dist) * force;
        tgt.vx! -= (dx / dist) * force;
        tgt.vy! -= (dy / dist) * force;
      }

      // Center gravity
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      for (const n of ns) {
        n.vx! += (cx - n.x!) * 0.002;
        n.vy! += (cy - n.y!) * 0.002;
        n.vx! *= 0.85;
        n.vy! *= 0.85;
        n.x! += n.vx!;
        n.y! += n.vy!;
      }
    };

    const draw = () => {
      const s = stateRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(s.offsetX, s.offsetY);
      ctx.scale(s.scale, s.scale);

      // Draw edges
      for (const e of s.edges) {
        const src = nodeMap.get(e.source);
        const tgt = nodeMap.get(e.target);
        if (!src || !tgt) continue;
        ctx.beginPath();
        ctx.moveTo(src.x!, src.y!);
        ctx.lineTo(tgt.x!, tgt.y!);
        ctx.strokeStyle = "oklch(0.55 0.28 280 / 0.25)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Edge glow
        ctx.beginPath();
        ctx.moveTo(src.x!, src.y!);
        ctx.lineTo(tgt.x!, tgt.y!);
        ctx.strokeStyle = "oklch(0.55 0.28 280 / 0.08)";
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      // Draw nodes
      for (const n of s.nodes) {
        const color = NODE_COLORS[n.type] || NODE_COLORS.default;
        const radius = 10;

        // Outer glow
        const grd = ctx.createRadialGradient(n.x!, n.y!, 0, n.x!, n.y!, radius * 3);
        grd.addColorStop(0, color + "40");
        grd.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(n.x!, n.y!, radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Node circle
        ctx.beginPath();
        ctx.arc(n.x!, n.y!, radius, 0, Math.PI * 2);
        ctx.fillStyle = color + "30";
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner dot
        ctx.beginPath();
        ctx.arc(n.x!, n.y!, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Label
        ctx.fillStyle = "oklch(0.85 0.02 265)";
        ctx.font = "11px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(n.label.length > 14 ? n.label.slice(0, 14) + "…" : n.label, n.x!, n.y! + radius + 14);
      }

      ctx.restore();
      simulate();
      s.animFrame = requestAnimationFrame(draw);
    };

    draw();

    // Mouse events
    const getNode = (mx: number, my: number) => {
      const s = stateRef.current;
      const wx = (mx - s.offsetX) / s.scale;
      const wy = (my - s.offsetY) / s.scale;
      return s.nodes.find((n) => {
        const dx = n.x! - wx;
        const dy = n.y! - wy;
        return Math.sqrt(dx * dx + dy * dy) < 14;
      });
    };

    const onMouseDown = (e: MouseEvent) => {
      const s = stateRef.current;
      s.dragging = true;
      s.lastX = e.clientX;
      s.lastY = e.clientY;
    };
    const onMouseMove = (e: MouseEvent) => {
      const s = stateRef.current;
      if (s.dragging) {
        s.offsetX += e.clientX - s.lastX;
        s.offsetY += e.clientY - s.lastY;
        s.lastX = e.clientX;
        s.lastY = e.clientY;
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      const s = stateRef.current;
      if (Math.abs(e.clientX - s.lastX) < 3 && Math.abs(e.clientY - s.lastY) < 3) {
        const rect = canvas.getBoundingClientRect();
        const n = getNode(e.clientX - rect.left, e.clientY - rect.top);
        if (n) onNodeClick(n);
      }
      s.dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = stateRef.current;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      s.scale = Math.max(0.3, Math.min(3, s.scale * delta));
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(stateRef.current.animFrame);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [nodes, edges]);

  const zoom = (factor: number) => {
    stateRef.current.scale = Math.max(0.3, Math.min(3, stateRef.current.scale * factor));
  };
  const reset = () => {
    stateRef.current.scale = 1;
    stateRef.current.offsetX = 0;
    stateRef.current.offsetY = 0;
  };

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button onClick={() => zoom(1.2)} className="w-8 h-8 glass rounded-lg flex items-center justify-center text-[oklch(0.75_0.02_265)] hover:text-[oklch(0.97_0.005_265)] border border-[oklch(0.30_0.04_265_/_0.40)] transition-colors">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button onClick={() => zoom(0.8)} className="w-8 h-8 glass rounded-lg flex items-center justify-center text-[oklch(0.75_0.02_265)] hover:text-[oklch(0.97_0.005_265)] border border-[oklch(0.30_0.04_265_/_0.40)] transition-colors">
          <ZoomOut className="w-4 h-4" />
        </button>
        <button onClick={reset} className="w-8 h-8 glass rounded-lg flex items-center justify-center text-[oklch(0.75_0.02_265)] hover:text-[oklch(0.97_0.005_265)] border border-[oklch(0.30_0.04_265_/_0.40)] transition-colors">
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function GraphExplorer() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || "0");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const { data: project } = trpc.projects.get.useQuery({ id: projectId }, { enabled: !!projectId });
  const { data: graph, isLoading } = trpc.graph.get.useQuery({ projectId }, { enabled: !!projectId });

  const nodes: GraphNode[] = (graph?.nodes || []).map((n: any) => ({ id: String(n.id), label: n.label, type: n.type, description: n.description, x: n.x, y: n.y }));
  const edges: GraphEdge[] = (graph?.edges || []).map((e: any) => ({ source: String(e.sourceId), target: String(e.targetId), label: e.label }));

  const nodeTypeColors = Object.entries(NODE_COLORS).filter(([k]) => k !== "default");

  return (
    <div className="min-h-screen nebula-bg flex flex-col">
      <TopNav />
      <div className="pt-16 flex flex-col flex-1">
        {/* Header bar */}
        <div className="glass-strong border-b border-[oklch(0.30_0.04_265_/_0.30)] px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-cormorant text-[oklch(0.55_0.02_265)]">
              <Link href="/" className="hover:text-[oklch(0.65_0.30_280)] transition-colors">Dashboard</Link>
              <ChevronRight className="w-3 h-3" />
              <Link href={`/project/${projectId}`} className="hover:text-[oklch(0.65_0.30_280)] transition-colors">{project?.title || "Project"}</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-[oklch(0.97_0.005_265)]">Graph Explorer</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3">
              {nodeTypeColors.map(([type, color]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="font-jetbrains text-[10px] text-[oklch(0.55_0.02_265)] capitalize">{type}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass border border-[oklch(0.30_0.04_265_/_0.35)]">
              <Network className="w-3.5 h-3.5 text-[oklch(0.65_0.30_280)]" />
              <span className="font-jetbrains text-xs text-[oklch(0.75_0.02_265)]">
                {nodes.length} nodes · {edges.length} edges
              </span>
            </div>
          </div>
        </div>

        {/* Graph Canvas */}
        <div className="flex-1 relative" style={{ minHeight: "calc(100vh - 8rem)" }}>
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 rounded-full border-2 border-[oklch(0.55_0.28_280_/_0.30)] border-t-[oklch(0.65_0.30_280)] animate-spin" />
                <p className="font-cinzel text-xs tracking-[0.2em] text-[oklch(0.55_0.02_265)]">LOADING GRAPH</p>
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <Network className="w-12 h-12 text-[oklch(0.30_0.04_265)]" />
              <p className="font-cinzel text-sm text-[oklch(0.55_0.02_265)]">No graph data yet</p>
              <Link href={`/project/${projectId}/wizard`}>
                <Button size="sm" className="font-cinzel text-xs tracking-wider bg-[oklch(0.55_0.28_280)] hover:bg-[oklch(0.60_0.30_280)] text-[oklch(0.97_0.005_265)] border border-[oklch(0.65_0.30_280_/_0.40)]">
                  Build Graph in Wizard
                </Button>
              </Link>
            </div>
          ) : (
            <ForceGraph nodes={nodes} edges={edges} onNodeClick={setSelectedNode} />
          )}

          {/* Node Inspector Panel */}
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute top-4 right-4 w-72 glass-strong rounded-2xl p-5 border border-[oklch(0.35_0.05_265_/_0.40)]"
              style={{ background: "oklch(0.10 0.02 265 / 0.95)" }}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full" style={{ background: NODE_COLORS[selectedNode.type] || NODE_COLORS.default }} />
                    <span className="font-jetbrains text-[10px] tracking-wider text-[oklch(0.55_0.02_265)] capitalize">{selectedNode.type}</span>
                  </div>
                  <h3 className="font-cinzel text-base font-semibold text-[oklch(0.97_0.005_265)]">{selectedNode.label}</h3>
                </div>
                <button onClick={() => setSelectedNode(null)} className="text-[oklch(0.45_0.02_265)] hover:text-[oklch(0.97_0.005_265)] transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {selectedNode.description && (
                <p className="font-cormorant text-sm text-[oklch(0.70_0.02_265)] leading-relaxed">
                  {selectedNode.description}
                </p>
              )}
              <div className="mt-4 pt-4 border-t border-[oklch(0.25_0.03_265_/_0.30)]">
                <p className="font-jetbrains text-[10px] text-[oklch(0.40_0.02_265)]">
                  ID: {selectedNode.id}
                </p>
                <p className="font-jetbrains text-[10px] text-[oklch(0.40_0.02_265)] mt-1">
                  Connections: {edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).length}
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
