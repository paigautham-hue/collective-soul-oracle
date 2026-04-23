// Public read-only REST surface — no auth, slug-gated.
//
//   GET /api/public/share/:slug             → JSON { project, report }
//   GET /api/public/share/:slug/report.pdf  → PDF download
//   GET /api/public/share/:slug/report.pptx → PPTX download
//
// Designed so external systems can integrate with Oracle predictions without
// going through tRPC. Slugs are nanoid(16); revoke via tRPC share.revoke.

import type { Express, Request, Response } from "express";
import { getShareLinkBySlug, bumpShareLinkViews } from "./db-extensions";
import { getProjectById } from "./db";
import { getReportById } from "./db";
import { renderReportPdf, renderReportPptx } from "./report-export";

async function resolveSlug(slug: string): Promise<{ ok: false; status: number; reason: string } | { ok: true; project: NonNullable<Awaited<ReturnType<typeof getProjectById>>>; report: Awaited<ReturnType<typeof getReportById>> | null }> {
  const link = await getShareLinkBySlug(slug);
  if (!link) return { ok: false, status: 404, reason: "not_found" };
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return { ok: false, status: 410, reason: "expired" };
  await bumpShareLinkViews(link.id);
  const project = await getProjectById(link.projectId);
  if (!project) return { ok: false, status: 404, reason: "project_missing" };
  const report = link.reportId ? await getReportById(link.reportId) : null;
  return { ok: true, project, report };
}

export function registerPublicApi(app: Express) {
  app.get("/api/public/share/:slug", async (req: Request, res: Response) => {
    try {
      const r = await resolveSlug(req.params.slug);
      if (!r.ok) {
        res.status(r.status).json({ error: r.reason });
        return;
      }
      res.json({
        project: { id: r.project.id, title: r.project.title, description: r.project.description, topic: r.project.topic },
        report: r.report
          ? { id: r.report.id, title: r.report.title, summary: r.report.summary, content: r.report.content, createdAt: r.report.createdAt }
          : null,
      });
    } catch (err) {
      console.error("[public-api] share GET failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.get("/api/public/share/:slug/report.pdf", async (req, res) => {
    try {
      const r = await resolveSlug(req.params.slug);
      if (!r.ok) { res.status(r.status).json({ error: r.reason }); return; }
      if (!r.report) { res.status(404).json({ error: "no_report" }); return; }
      const bytes = await renderReportPdf(r.report);
      res.setHeader("content-type", "application/pdf");
      res.setHeader("content-disposition", `inline; filename="report-${r.report.id}.pdf"`);
      res.send(Buffer.from(bytes));
    } catch (err) {
      console.error("[public-api] pdf failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.get("/api/public/share/:slug/report.pptx", async (req, res) => {
    try {
      const r = await resolveSlug(req.params.slug);
      if (!r.ok) { res.status(r.status).json({ error: r.reason }); return; }
      if (!r.report) { res.status(404).json({ error: "no_report" }); return; }
      const buf = await renderReportPptx(r.report);
      res.setHeader("content-type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("content-disposition", `attachment; filename="report-${r.report.id}.pptx"`);
      res.send(buf);
    } catch (err) {
      console.error("[public-api] pptx failed:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
