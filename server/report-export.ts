// Render a report's markdown content to PDF and PPTX deliverables.
// Kept minimal — the goal is shareable, branded artefacts, not full
// markdown-to-print fidelity.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import PptxGenJS from "pptxgenjs";

interface ReportLike {
  title?: string | null;
  content?: string | null;
  summary?: string | null;
  metadata?: unknown;
}

const MAX_LINE_CHARS = 95;

function wrap(text: string, max = MAX_LINE_CHARS): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ─── PDF ────────────────────────────────────────────────────────────────────
export async function renderReportPdf(report: ReportLike): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;  // letter
  const pageHeight = 792;
  const margin = 56;
  const lineHeight = 14;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const writeLine = (text: string, opts?: { font?: typeof font; size?: number; color?: ReturnType<typeof rgb> }) => {
    if (y < margin + lineHeight) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(text, {
      x: margin,
      y,
      size: opts?.size ?? 11,
      font: opts?.font ?? font,
      color: opts?.color ?? rgb(0.12, 0.12, 0.16),
    });
    y -= (opts?.size ? opts.size + 4 : lineHeight);
  };

  writeLine(report.title ?? "Oracle Prediction Report", { font: bold, size: 22, color: rgb(0.05, 0.4, 0.6) });
  y -= 8;
  writeLine(`Generated ${new Date().toISOString().slice(0, 10)}`, { size: 9, color: rgb(0.5, 0.5, 0.55) });
  y -= 12;

  if (report.summary) {
    writeLine("Executive Summary", { font: bold, size: 13, color: rgb(0.1, 0.1, 0.2) });
    for (const line of wrap(report.summary, 100)) writeLine(line);
    y -= 10;
  }

  if (report.content) {
    writeLine("Full Analysis", { font: bold, size: 13, color: rgb(0.1, 0.1, 0.2) });
    // Strip simple markdown for plain text rendering.
    const stripped = report.content
      .replace(/^#+\s*/gm, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1");
    for (const block of stripped.split(/\n{2,}/)) {
      for (const line of wrap(block, 100)) writeLine(line);
      y -= 6;
    }
  }

  return pdf.save();
}

// ─── PPTX ───────────────────────────────────────────────────────────────────
export async function renderReportPptx(report: ReportLike): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: "0B1220" };
  titleSlide.addText(report.title ?? "Oracle Prediction Report", {
    x: 0.5, y: 2.8, w: 12.3, h: 1.5,
    fontSize: 40, bold: true, color: "FFFFFF", fontFace: "Inter",
  });
  titleSlide.addText(`Generated ${new Date().toISOString().slice(0, 10)}`, {
    x: 0.5, y: 4.5, w: 12.3, h: 0.5,
    fontSize: 14, color: "94A3B8", fontFace: "Inter",
  });

  // Summary slide
  if (report.summary) {
    const s = pptx.addSlide();
    s.background = { color: "F8FAFC" };
    s.addText("Executive Summary", {
      x: 0.5, y: 0.4, w: 12.3, h: 0.7,
      fontSize: 28, bold: true, color: "0F172A", fontFace: "Inter",
    });
    s.addText(report.summary.slice(0, 1200), {
      x: 0.5, y: 1.2, w: 12.3, h: 6,
      fontSize: 16, color: "1E293B", fontFace: "Inter", valign: "top",
    });
  }

  // Content split across slides — every ~1500 chars or H1 break.
  if (report.content) {
    const sections = report.content.split(/\n(?=#\s)/);
    for (const section of sections) {
      const headerMatch = section.match(/^#+\s*(.+)/);
      const title = headerMatch ? headerMatch[1] : "Analysis";
      const body = section.replace(/^#+.*\n/, "").trim();
      const chunks = chunkText(body, 1500);
      for (let idx = 0; idx < chunks.length; idx++) {
        const s = pptx.addSlide();
        s.background = { color: "FFFFFF" };
        s.addText(idx === 0 ? title : `${title} (cont.)`, {
          x: 0.5, y: 0.4, w: 12.3, h: 0.7,
          fontSize: 24, bold: true, color: "0F172A", fontFace: "Inter",
        });
        s.addText(chunks[idx], {
          x: 0.5, y: 1.2, w: 12.3, h: 6,
          fontSize: 14, color: "1E293B", fontFace: "Inter", valign: "top",
        });
      }
    }
  }

  // pptxgenjs returns Buffer when output type=nodebuffer
  const buf = await pptx.write({ outputType: "nodebuffer" });
  return buf as Buffer;
}

function chunkText(s: string, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out.length > 0 ? out : [""];
}
