import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Users, ChevronRight, Sparkles, Zap, Briefcase, Cpu, ArrowRight } from "lucide-react";

const SCOPE_META: Record<"narrative" | "technical" | "finance", { label: string; color: string; icon: typeof Users }> = {
  narrative: { label: "Narrative", color: "oklch(0.65 0.30 280)", icon: Sparkles },
  technical: { label: "Technical", color: "oklch(0.65 0.20 200)", icon: Cpu },
  finance:   { label: "Finance",   color: "oklch(0.72 0.18 145)", icon: Briefcase },
};

export default function PersonaLibrary() {
  const [, navigate] = useLocation();
  const [scope, setScope] = useState<"all" | "narrative" | "technical" | "finance">("all");
  const [applyTo, setApplyTo] = useState<{ templateId: number; templateName: string } | null>(null);

  const { data: templates } = trpc.personas.list.useQuery({ scope: scope === "all" ? undefined : scope });
  const { data: projects } = trpc.projects.list.useQuery();

  const applyMutation = trpc.personas.applyToProject.useMutation({
    onSuccess: (d) => {
      toast.success(`Applied: ${d.applied} agents added, ${d.skipped} skipped (already exist)`);
      setApplyTo(null);
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
          <span className="text-white">Persona library</span>
        </div>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-light flex items-center gap-3">
              <Users className="w-8 h-8" style={{ color: "oklch(0.65 0.30 280)" }} />
              Persona Library
            </h1>
            <p className="text-sm mt-2" style={{ color: "oklch(0.55 0.02 265)" }}>
              Curated expert persona packs. One-click apply to any project.
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {(["all", "narrative", "technical", "finance"] as const).map((s) => {
            const meta = s === "all" ? null : SCOPE_META[s];
            const isActive = scope === s;
            const color = meta?.color ?? "oklch(0.55 0.02 265)";
            return (
              <button
                key={s}
                onClick={() => setScope(s)}
                className="px-3 py-1.5 rounded-full text-xs font-mono tracking-wider border transition-all"
                style={{
                  background: isActive ? `${color} / 0.18` : "transparent",
                  borderColor: isActive ? color : "oklch(0.25 0.05 265 / 0.5)",
                  color: isActive ? color : "oklch(0.65 0.02 265)",
                }}
              >
                {(s === "all" ? "ALL" : meta!.label.toUpperCase())}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {(templates ?? []).map((t) => {
            const meta = SCOPE_META[t.scope as "narrative" | "technical" | "finance"];
            const Icon = meta.icon;
            return (
              <div key={t.id} className="rounded-lg border p-5"
                   style={{ background: "oklch(0.08 0.02 265 / 0.6)", borderColor: "oklch(0.20 0.05 265 / 0.5)" }}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" style={{ color: meta.color }} />
                    <span className="text-xs uppercase tracking-wider" style={{ color: meta.color }}>{meta.label}</span>
                    {t.isSystem && <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: "oklch(0.30 0.05 265)", color: "oklch(0.55 0.02 265)" }}>SYSTEM</span>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setApplyTo({ templateId: t.id, templateName: t.name })}>
                    <Zap className="w-3.5 h-3.5 mr-1" /> Apply
                  </Button>
                </div>
                <h3 className="font-medium mb-1">{t.name}</h3>
                {t.description && <p className="text-sm mb-3" style={{ color: "oklch(0.65 0.02 265)" }}>{t.description}</p>}
                <details className="text-xs">
                  <summary className="cursor-pointer hover:text-white" style={{ color: "oklch(0.55 0.02 265)" }}>
                    {t.personas?.length ?? 0} personas
                  </summary>
                  <ul className="mt-2 space-y-1.5 pl-2">
                    {(t.personas ?? []).map((p, i) => (
                      <li key={i}>
                        <div className="font-medium">{p.name}</div>
                        <div className="opacity-70">{p.persona}</div>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={!!applyTo} onOpenChange={(o) => !o && setApplyTo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply "{applyTo?.templateName}" to which project?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {(projects ?? []).length === 0 && <p className="text-sm text-muted-foreground">No projects yet. Create one first.</p>}
            {(projects ?? []).map((p) => (
              <button
                key={p.id}
                disabled={applyMutation.isPending}
                onClick={() => applyMutation.mutate({ templateId: applyTo!.templateId, projectId: p.id })}
                className="w-full text-left p-3 rounded border hover:bg-[oklch(0.10_0.02_265)] flex items-center justify-between"
                style={{ borderColor: "oklch(0.20 0.05 265 / 0.5)" }}
              >
                <div>
                  <div className="font-medium text-sm">{p.title}</div>
                  <div className="text-xs" style={{ color: "oklch(0.55 0.02 265)" }}>
                    {p.projectType ?? "narrative"} · {p.status}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4" style={{ color: "oklch(0.55 0.02 265)" }} />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
