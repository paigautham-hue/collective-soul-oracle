import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Share2, Copy, Trash2, Check, ExternalLink } from "lucide-react";

interface Props {
  projectId: number;
  reportId?: number;
  trigger?: React.ReactNode;
}

export default function ShareManager({ projectId, reportId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"report" | "project_readonly">(reportId ? "report" : "project_readonly");
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const { data: links, refetch } = trpc.share.list.useQuery({ projectId }, { enabled: open });

  const createMutation = trpc.share.create.useMutation({
    onSuccess: () => { toast.success("Share link created"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const revokeMutation = trpc.share.revoke.useMutation({
    onSuccess: () => { toast.success("Revoked"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const linkUrl = (slug: string) => `${baseUrl}/share/${slug}`;

  const copy = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(linkUrl(slug));
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 1800);
    } catch { toast.error("Copy failed"); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="ghost" size="sm"><Share2 className="w-4 h-4 mr-1.5" /> Share</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share this {scope === "report" ? "report" : "project"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="flex gap-2">
            <select
              className="flex-1 bg-transparent border rounded px-3 py-2 text-sm"
              value={scope}
              onChange={(e) => setScope(e.target.value as typeof scope)}
            >
              {reportId && <option value="report">Report only</option>}
              <option value="project_readonly">Whole project (read-only)</option>
            </select>
            <select
              className="bg-transparent border rounded px-3 py-2 text-sm"
              value={expiresInDays ?? ""}
              onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : undefined)}
            >
              <option value="">Never expires</option>
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
            <Button
              size="sm"
              onClick={() => createMutation.mutate({ projectId, reportId, scope, expiresInDays })}
              disabled={createMutation.isPending}
            >
              Create
            </Button>
          </div>

          <div className="space-y-2 mt-2 max-h-72 overflow-y-auto">
            {(links ?? []).length === 0 && <p className="text-xs text-muted-foreground">No share links yet.</p>}
            {(links ?? []).map((l) => (
              <div key={l.id} className="p-2.5 rounded border flex items-center justify-between gap-2 text-xs"
                   style={{ borderColor: "oklch(0.25 0.05 265 / 0.5)", background: "oklch(0.06 0.02 265 / 0.4)" }}>
                <div className="flex-1 min-w-0">
                  <code className="block truncate font-mono">{linkUrl(l.slug)}</code>
                  <div className="text-[10px] mt-0.5" style={{ color: "oklch(0.55 0.02 265)" }}>
                    {l.scope} · {l.views} view{l.views === 1 ? "" : "s"}
                    {l.expiresAt ? ` · expires ${new Date(l.expiresAt).toLocaleDateString()}` : " · never expires"}
                    {l.revoked ? " · REVOKED" : ""}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => copy(l.slug)} title="Copy link">
                    {copiedSlug === l.slug ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                  <a href={linkUrl(l.slug)} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="ghost" title="Open"><ExternalLink className="w-3.5 h-3.5" /></Button>
                  </a>
                  {!l.revoked && (
                    <Button size="sm" variant="ghost" onClick={() => revokeMutation.mutate({ id: l.id })} title="Revoke">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
