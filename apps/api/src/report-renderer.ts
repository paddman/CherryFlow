import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import PDFDocument from "pdfkit";
import type { ReportChart, ReportDocumentModel, ReportFormat, ReportKpi, ReportRecommendation, ReportRisk, ReportSection, ReportTable } from "./report-document.js";

const require = createRequire(import.meta.url);

export type { ReportDocumentModel, ReportFormat } from "./report-document.js";

export interface RenderedReport {
  fileName: string;
  mimeType: string;
  content: string | Buffer;
}

const thaiFontPath = [
  "/usr/share/fonts/truetype/tlwg/Garuda.ttf",
  "/usr/share/fonts/truetype/tlwg/Loma.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
].find((path) => existsSync(path));

const mimeTypes: Record<ReportFormat, string> = {
  pdf: "application/pdf",
  html: "text/html;charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function normalizeReportFormat(value: unknown): ReportFormat {
  const normalized = String(value ?? "pdf").trim().toLowerCase();
  if (["html", "web", "website"].includes(normalized)) return "html";
  if (["docx", "word", "world", "msword"].includes(normalized)) return "docx";
  if (["pptx", "ppt", "powerpoint", "slides"].includes(normalized)) return "pptx";
  return "pdf";
}

export function safeReportSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9ก-๙]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "report";
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function markdownToText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^- /gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  let inList = false;
  const html: string[] = [];
  for (const line of lines) {
    if (line.startsWith("- ")) {
      if (!inList) html.push("<ul>");
      inList = true;
      html.push(`<li>${escapeHtml(line.slice(2))}</li>`);
      continue;
    }
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
    if (line.startsWith("### ")) html.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
    else if (line.startsWith("## ")) html.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    else if (line.startsWith("# ")) html.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    else if (line.trim()) html.push(`<p>${escapeHtml(line)}</p>`);
  }
  if (inList) html.push("</ul>");
  return html.join("\n");
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function maxChartValue(chart: ReportChart): number {
  return Math.max(...chart.data.map((item) => Math.abs(item.value)), 1);
}

function flowNodeLabel(model: ReportDocumentModel, id: string): string {
  return model.flow.nodes.find((node) => node.id === id)?.label ?? id;
}

function renderHtmlFlow(model: ReportDocumentModel): string {
  return `
      <section id="workflow-flow" class="flowSection">
        <div class="flowHeader">
          <span class="pill">FLOW</span>
          <h2>${escapeHtml(model.flow.title)}</h2>
          <p>${escapeHtml(model.flow.description)}</p>
        </div>
        <div class="flowRail">${model.flow.nodes.map((node) => `
          <article class="flowNode flow-${escapeHtml(node.status)}">
            <span class="flowKind">${escapeHtml(node.kind)}</span>
            <strong>${escapeHtml(node.label)}</strong>
            <p>${escapeHtml(node.detail)}</p>
            <small>${escapeHtml(node.status)}</small>
          </article>`).join("\n")}
        </div>
        <div class="flowEdges">${model.flow.edges.map((edge) => `<span>${escapeHtml(flowNodeLabel(model, edge.from))} → ${escapeHtml(flowNodeLabel(model, edge.to))}${edge.label ? ` · ${escapeHtml(edge.label)}` : ""}</span>`).join("\n")}</div>
      </section>`;
}

function renderHtml(model: ReportDocumentModel): string {
  const maxByChart = new Map(model.charts.map((chart) => [chart.id, maxChartValue(chart)]));
  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(model.title)}</title>
  <style>
    :root { --accent:${model.theme.accentColor}; --dark:${model.theme.accentDark}; --bg:${model.theme.backgroundColor}; --surface:${model.theme.surfaceColor}; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Garuda", "Noto Sans Thai", Inter, system-ui, sans-serif; background: var(--bg); color: #142033; line-height: 1.65; }
    .cover { min-height: 72vh; padding: 64px clamp(24px,6vw,86px); display: grid; align-content: center; color: white; background: radial-gradient(circle at 80% 15%, rgba(255,255,255,.22), transparent 34%), linear-gradient(135deg,var(--dark),var(--accent)); }
    .cover small { text-transform: uppercase; letter-spacing: .18em; font-weight: 900; opacity: .76; }
    .cover h1 { max-width: 980px; margin: 16px 0 12px; font-size: clamp(46px,8vw,92px); line-height: .98; letter-spacing: -.06em; }
    .cover p { max-width: 760px; margin: 0; font-size: 20px; opacity: .86; }
    .meta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 32px; }
    .meta span { padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.24); font-weight: 800; }
    .shell { display: grid; grid-template-columns: 260px minmax(0,1fr); gap: 26px; width: min(1440px,100%); margin: 0 auto; padding: 30px clamp(16px,3vw,40px) 70px; }
    nav { position: sticky; top: 18px; align-self: start; padding: 18px; border-radius: 24px; background: rgba(255,255,255,.82); border: 1px solid rgba(28,66,120,.13); box-shadow: 0 18px 45px rgba(33,55,88,.1); backdrop-filter: blur(18px); }
    nav h2 { margin: 0 0 12px; font-size: 15px; color: var(--dark); }
    nav a { display: block; padding: 9px 10px; border-radius: 12px; color: #31425f; text-decoration: none; font-size: 13px; font-weight: 800; }
    nav a:hover { background: color-mix(in srgb, var(--accent) 12%, white); color: var(--dark); }
    main { display: grid; gap: 24px; min-width: 0; }
    section, .card { background: var(--surface); border: 1px solid rgba(28,66,120,.13); border-radius: 28px; box-shadow: 0 22px 60px rgba(33,55,88,.1); padding: clamp(22px,3vw,34px); }
    h2 { margin: 0 0 16px; color: var(--dark); font-size: clamp(24px,3vw,36px); letter-spacing: -.03em; }
    h3 { color: var(--dark); }
    .dashboard { display: grid; gap: 18px; }
    .kpis { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 14px; }
    .kpi { padding: 18px; border-radius: 22px; background: linear-gradient(180deg,#fff,#f7faff); border: 1px solid rgba(28,66,120,.12); }
    .kpi span { display: block; color: #607089; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
    .kpi strong { display: block; margin: 8px 0; font-size: clamp(24px,4vw,42px); color: #111c2f; overflow-wrap: anywhere; }
    .kpi p { margin: 0; color: #63718a; font-size: 13px; }
    .charts { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16px; }
    .chart p { margin-top: 0; color: #5c6b80; }
    .bar { display: grid; grid-template-columns: minmax(92px, 160px) 1fr 70px; gap: 10px; align-items: center; margin: 10px 0; }
    .bar label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 800; color: #33435c; }
    .track { height: 16px; border-radius: 999px; background: #edf2f8; overflow: hidden; }
    .fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg,var(--accent),#8bbcff); }
    .bar b { text-align: right; color: #475870; font-size: 12px; }
    .flowSection { overflow: hidden; }
    .flowHeader p { max-width: 840px; margin: 0 0 18px; color: #5c6b80; }
    .flowRail { counter-reset: flow-step; display: grid; grid-template-columns: repeat(auto-fit,minmax(160px,1fr)); gap: 14px; }
    .flowNode { counter-increment: flow-step; position: relative; min-height: 176px; padding: 18px 16px 16px; border-radius: 22px; background: linear-gradient(180deg,#fff,#f7fbff); border: 1px solid rgba(28,66,120,.13); box-shadow: 0 14px 36px rgba(33,55,88,.08); }
    .flowNode::before { content: counter(flow-step); display: grid; place-items: center; width: 30px; height: 30px; margin-bottom: 12px; border-radius: 11px; color: #fff; background: var(--accent); font-weight: 900; }
    .flowNode:not(:last-child)::after { content: "→"; position: absolute; right: -14px; top: 42px; z-index: 2; width: 26px; height: 26px; display: grid; place-items: center; border-radius: 999px; color: var(--dark); background: #fff; border: 1px solid rgba(28,66,120,.13); box-shadow: 0 8px 20px rgba(33,55,88,.08); font-weight: 900; }
    .flowKind { display: inline-flex; margin-bottom: 8px; padding: 4px 8px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 12%, white); color: var(--dark); font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
    .flowNode strong { display: block; color: #172033; font-size: 16px; }
    .flowNode p { margin: 7px 0 10px; color: #5c6b80; font-size: 12.5px; line-height: 1.55; }
    .flowNode small { color: #0f8a64; font-size: 11px; font-weight: 900; text-transform: uppercase; }
    .flowEdges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
    .flowEdges span { padding: 7px 10px; border-radius: 999px; background: #f0f6ff; color: #3b4c65; font-size: 11px; font-weight: 800; }
    .sections { display: grid; gap: 18px; }
    .sectionBody ul, .recommendationList, .riskList { margin: 10px 0 0; padding-left: 20px; display: grid; gap: 9px; }
    .grid2 { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16px; }
    .rec, .risk { border-radius: 18px; padding: 16px; background: #f8fbff; border: 1px solid rgba(28,66,120,.1); }
    .pill { display: inline-flex; padding: 5px 9px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 12%, white); color: var(--dark); font-size: 11px; font-weight: 900; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; border-bottom: 1px solid #e4ebf5; padding: 10px 12px; vertical-align: top; }
    th { color: var(--dark); background: #f8fbff; font-size: 12px; text-transform: uppercase; }
    pre { white-space: pre-wrap; overflow: auto; border-radius: 20px; padding: 18px; background: #0f172a; color: #dbeafe; }
    @page { size: A4; margin: 14mm 12mm; }
    @media print {
      html, body { background: #fff; font-size: 10.5pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .cover { min-height: auto; height: 269mm; page-break-after: always; padding: 30mm 22mm; }
      .cover h1 { font-size: 42pt; line-height: 1; max-width: 170mm; }
      .cover p { font-size: 14pt; max-width: 150mm; }
      .meta span { font-size: 9pt; }
      .shell { display: block; width: 100%; padding: 0; }
      nav { position: static; page-break-after: always; box-shadow: none; background: #fff; border-radius: 12px; }
      nav a { display: block; break-inside: avoid; color: #142033; }
      main { display: block; }
      section, .card { margin: 0 0 8mm; padding: 9mm; border-radius: 12px; box-shadow: none; break-inside: avoid; page-break-inside: avoid; }
      .dashboard { page-break-after: always; }
      .kpis { grid-template-columns: repeat(3,minmax(0,1fr)); gap: 8px; }
      .kpi { padding: 10px; border-radius: 10px; }
      .kpi strong { font-size: 18pt; }
      .charts, .grid2 { grid-template-columns: 1fr; }
      .flowRail { grid-template-columns: repeat(2,minmax(0,1fr)); }
      .flowNode { min-height: 136px; }
      .flowNode::after { display: none !important; }
      .chart { break-inside: avoid; page-break-inside: avoid; }
      .bar { grid-template-columns: 38mm 1fr 22mm; }
      h2 { font-size: 20pt; }
      h3 { font-size: 14pt; }
      table { font-size: 8pt; page-break-inside: auto; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      th, td { padding: 4px 5px; }
      pre { max-height: none; font-size: 8pt; white-space: pre-wrap; }
    }
    @media (max-width: 980px) { .shell { grid-template-columns: 1fr; } nav { position: static; } .kpis, .charts, .grid2 { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header class="cover" id="cover">
    <small>${escapeHtml(model.theme.name)} · ${escapeHtml(model.outputFormat.toUpperCase())}</small>
    <h1>${escapeHtml(model.title)}</h1>
    <p>${escapeHtml(model.subtitle)}</p>
    <div class="meta">
      <span>${escapeHtml(model.department)}</span>
      <span>${escapeHtml(model.fileName)}</span>
      <span>${escapeHtml(formatDate(model.generatedAt))}</span>
      <span>${escapeHtml(model.audience)}</span>
    </div>
  </header>
  <div class="shell">
    <nav>
      <h2>สารบัญ</h2>
      ${model.tableOfContents.map((item) => `<a href="#${escapeHtml(item.id)}">${escapeHtml(item.title)}</a>`).join("\n")}
    </nav>
    <main>
      <section id="dashboard" class="dashboard">
        <h2>Executive Dashboard</h2>
        <div class="kpis">${model.kpis.map((kpi) => `<article class="kpi"><span>${escapeHtml(kpi.label)}</span><strong>${escapeHtml(kpi.value)}</strong><p>${escapeHtml(kpi.detail)}</p></article>`).join("\n")}</div>
        <div class="charts">${model.charts.map((chart) => `<article class="chart card" id="${escapeHtml(chart.id)}"><h3>${escapeHtml(chart.title)}</h3><p>${escapeHtml(chart.insight)}</p>${chart.data.map((item) => {
          const percent = Math.max(4, Math.round(Math.abs(item.value) / (maxByChart.get(chart.id) ?? 1) * 100));
          return `<div class="bar"><label>${escapeHtml(item.label)}</label><div class="track"><div class="fill" style="width:${percent}%"></div></div><b>${escapeHtml(String(item.value))}</b></div>`;
        }).join("\n")}</article>`).join("\n")}</div>
      </section>
      ${renderHtmlFlow(model)}
      <section id="executive-summary"><h2>บทสรุปผู้บริหาร</h2>${markdownToHtml(model.summaryMarkdown)}</section>
      <div class="sections">${model.sections.map((section) => `<section id="${escapeHtml(section.id)}" class="sectionBody"><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p><ul>${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul></section>`).join("\n")}</div>
      <section id="tables"><h2>Data Tables</h2>${model.tables.map(renderHtmlTable).join("\n")}</section>
      <section id="recommendations"><h2>Recommendations & Risks</h2><div class="grid2"><div>${model.recommendations.map((item) => `<article class="rec"><span class="pill">${escapeHtml(item.priority)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.detail)}</p></article>`).join("\n")}</div><div>${model.risks.map((item) => `<article class="risk"><span class="pill">${escapeHtml(item.level)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.mitigation)}</p></article>`).join("\n")}</div></div></section>
      <section id="appendix"><h2>Appendix</h2><p>${escapeHtml(model.aiStatus)} · Data shape: ${escapeHtml(model.appendix.dataShape)}</p><pre>${escapeHtml(model.appendix.sourcePreview)}</pre></section>
    </main>
  </div>
</body>
</html>`;
}

function renderHtmlTable(table: ReportTable): string {
  if (table.rows.length === 0) return `<p>ไม่มีข้อมูลตาราง</p>`;
  return `<h3>${escapeHtml(table.title)}</h3><table><thead><tr>${table.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${table.rows.map((row) => `<tr>${table.columns.map((column) => `<td>${escapeHtml(String(row[column] ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

async function renderPdfWithBrowser(model: ReportDocumentModel): Promise<Buffer> {
  const { chromium } = require("playwright") as typeof import("playwright");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 1 });
    await page.emulateMedia({ media: "print" });
    await page.setContent(renderHtml(model), { waitUntil: "load" });
    await page.evaluate(() => document.fonts?.ready);
    return Buffer.from(await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      tagged: true,
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#64748b;padding:0 12mm;display:flex;justify-content:space-between;font-family:Garuda,Arial,sans-serif;">
          <span>${escapeHtml(model.title)}</span>
          <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>`,
      margin: { top: "0", right: "0", bottom: "10mm", left: "0" },
    }));
  } finally {
    await browser.close();
  }
}

function setPdfFont(doc: PDFKit.PDFDocument): void {
  if (thaiFontPath) doc.font(thaiFontPath);
}

function ensurePdfSpace(doc: PDFKit.PDFDocument, height = 120): void {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    setPdfFont(doc);
  }
}

function pdfHeading(doc: PDFKit.PDFDocument, text: string, color: string): void {
  ensurePdfSpace(doc, 80);
  doc.moveDown(0.7).fontSize(18).fillColor(color).text(text);
  doc.moveDown(0.25);
}

function pdfBody(doc: PDFKit.PDFDocument, text: string): void {
  ensurePdfSpace(doc, 80);
  doc.fontSize(10.5).fillColor("#172033").text(text, { lineGap: 4 });
}

function drawPdfKpis(doc: PDFKit.PDFDocument, kpis: ReportKpi[], color: string): void {
  const startX = doc.x;
  let x = startX;
  let y = doc.y;
  const width = 158;
  for (const [index, kpi] of kpis.entries()) {
    if (index > 0 && index % 3 === 0) {
      x = startX;
      y += 96;
    }
    ensurePdfSpace(doc, 120);
    doc.roundedRect(x, y, width, 78, 12).fillAndStroke("#f7faff", "#d9e6f7");
    doc.fillColor("#607089").fontSize(8).text(kpi.label, x + 12, y + 12, { width: width - 24 });
    doc.fillColor(color).fontSize(18).text(kpi.value, x + 12, y + 28, { width: width - 24, height: 22 });
    doc.fillColor("#63718a").fontSize(8).text(kpi.detail, x + 12, y + 52, { width: width - 24, height: 20 });
    x += width + 12;
  }
  doc.y = y + 96;
}

function drawPdfChart(doc: PDFKit.PDFDocument, chart: ReportChart, color: string): void {
  ensurePdfSpace(doc, 180);
  doc.fontSize(13).fillColor("#102a5f").text(chart.title);
  doc.fontSize(9).fillColor("#5d6980").text(chart.insight, { lineGap: 3 });
  const max = maxChartValue(chart);
  const left = doc.x;
  const barX = left + 130;
  const valueX = doc.page.width - doc.page.margins.right - 54;
  for (const item of chart.data.slice(0, 8)) {
    ensurePdfSpace(doc, 32);
    const y = doc.y + 8;
    const width = Math.max(8, Math.abs(item.value) / max * 260);
    doc.fillColor("#33435c").fontSize(8).text(item.label, left, y, { width: 120, ellipsis: true });
    doc.roundedRect(barX, y + 2, 260, 10, 5).fill("#edf2f8");
    doc.roundedRect(barX, y + 2, width, 10, 5).fill(color);
    doc.fillColor("#475870").fontSize(8).text(String(item.value), valueX, y, { width: 54, align: "right" });
    doc.y = y + 20;
  }
}

async function renderPdfKitFallback(model: ReportDocumentModel): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: model.title, Author: "CherryFlow" } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    setPdfFont(doc);

    doc.rect(0, 0, doc.page.width, doc.page.height).fill(model.theme.accentDark);
    doc.fillColor("#ffffff").fontSize(11).text(`${model.theme.name} · ${model.outputFormat.toUpperCase()}`, 54, 92);
    doc.fontSize(34).text(model.title, 54, 150, { width: 480, lineGap: 2 });
    doc.fontSize(13).fillColor("#dbeafe").text(model.subtitle, 54, 250, { width: 440, lineGap: 5 });
    doc.fontSize(10).fillColor("#ffffff").text(`หน่วยงาน: ${model.department}\nไฟล์ต้นทาง: ${model.fileName}\nสร้างเมื่อ: ${formatDate(model.generatedAt)}\nกลุ่มผู้อ่าน: ${model.audience}`, 54, 365, { lineGap: 6 });

    doc.addPage();
    setPdfFont(doc);
    pdfHeading(doc, "สารบัญ", model.theme.accentDark);
    for (const item of model.tableOfContents) pdfBody(doc, `• ${item.title} (${item.kind})`);

    pdfHeading(doc, "Executive Dashboard", model.theme.accentDark);
    drawPdfKpis(doc, model.kpis, model.theme.accentColor);
    for (const chart of model.charts.slice(0, 3)) {
      pdfHeading(doc, chart.title, model.theme.accentDark);
      drawPdfChart(doc, chart, model.theme.accentColor);
    }

    pdfHeading(doc, model.flow.title, model.theme.accentDark);
    pdfBody(doc, [
      model.flow.description,
      ...model.flow.nodes.map((node, index) => `${index + 1}. ${node.label} [${node.kind}/${node.status}] — ${node.detail}`),
      `Edges: ${model.flow.edges.map((edge) => `${flowNodeLabel(model, edge.from)} → ${flowNodeLabel(model, edge.to)}${edge.label ? ` (${edge.label})` : ""}`).join(" | ")}`,
    ].join("\n"));

    pdfHeading(doc, "บทสรุปผู้บริหาร", model.theme.accentDark);
    pdfBody(doc, markdownToText(model.summaryMarkdown));
    for (const section of model.sections) {
      pdfHeading(doc, section.title, model.theme.accentDark);
      pdfBody(doc, [section.body, ...section.bullets.map((bullet) => `• ${bullet}`)].join("\n"));
    }
    pdfHeading(doc, "Recommendations", model.theme.accentDark);
    pdfBody(doc, model.recommendations.map((item) => `• [${item.priority}] ${item.title}: ${item.detail}`).join("\n"));
    pdfHeading(doc, "Risks", model.theme.accentDark);
    pdfBody(doc, model.risks.map((item) => `• [${item.level}] ${item.title}: ${item.mitigation}`).join("\n"));
    pdfHeading(doc, "Appendix", model.theme.accentDark);
    pdfBody(doc, `${model.aiStatus}\nData shape: ${model.appendix.dataShape}\n\n${model.appendix.sourcePreview.slice(0, 2400)}`);
    doc.end();
  });
}

async function renderPdf(model: ReportDocumentModel): Promise<Buffer> {
  try {
    return await renderPdfWithBrowser(model);
  } catch (error) {
    console.error("[report-renderer] browser PDF failed; falling back to PDFKit:", error);
    return renderPdfKitFallback(model);
  }
}

function docParagraph(text: string, options: { heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]; bullet?: boolean; bold?: boolean } = {}) {
  return new Paragraph({
    spacing: { after: 140 },
    ...(options.heading ? { heading: options.heading } : {}),
    ...(options.bullet ? { bullet: { level: 0 } } : {}),
    children: [new TextRun({ text, font: "Garuda", size: options.heading ? 28 : 22, bold: options.bold === true })],
  });
}

function docTable(title: string, columns: string[], rows: Array<Record<string, string | number | boolean>>): (Paragraph | Table)[] {
  if (rows.length === 0) return [docParagraph(title, { heading: HeadingLevel.HEADING_2 }), docParagraph("ไม่มีข้อมูล")];
  return [
    docParagraph(title, { heading: HeadingLevel.HEADING_2 }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: columns.map((column) => new TableCell({ children: [docParagraph(column, { bold: true })] })) }),
        ...rows.map((row) => new TableRow({ children: columns.map((column) => new TableCell({ children: [docParagraph(String(row[column] ?? ""))] })) })),
      ],
    }),
  ];
}

async function renderDocx(model: ReportDocumentModel): Promise<Buffer> {
  const metricRows = model.metrics.map((item) => ({ metric: item.metric, value: item.value }));
  const document = new Document({
    styles: { default: { document: { run: { font: "Garuda" } } } },
    sections: [{
      children: [
        new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun({ text: model.title, font: "Garuda", bold: true, size: 42 })] }),
        docParagraph(model.subtitle),
        docParagraph(`หน่วยงาน: ${model.department}`),
        docParagraph(`ไฟล์ต้นทาง: ${model.fileName}`),
        docParagraph(`สร้างเมื่อ: ${formatDate(model.generatedAt)}`),
        docParagraph("สารบัญ", { heading: HeadingLevel.HEADING_1 }),
        ...model.tableOfContents.map((item) => docParagraph(`${item.title} (${item.kind})`, { bullet: true })),
        docParagraph("Executive Dashboard", { heading: HeadingLevel.HEADING_1 }),
        ...model.kpis.map((kpi) => docParagraph(`${kpi.label}: ${kpi.value} — ${kpi.detail}`, { bullet: true })),
        ...model.charts.flatMap((chart) => docTable(chart.title, ["label", "value"], chart.data)),
        docParagraph(model.flow.title, { heading: HeadingLevel.HEADING_1 }),
        docParagraph(model.flow.description),
        ...model.flow.nodes.map((node, index) => docParagraph(`${index + 1}. ${node.label} [${node.kind}/${node.status}] — ${node.detail}`, { bullet: true })),
        docParagraph(`Edges: ${model.flow.edges.map((edge) => `${flowNodeLabel(model, edge.from)} → ${flowNodeLabel(model, edge.to)}${edge.label ? ` (${edge.label})` : ""}`).join(" | ")}`),
        docParagraph("บทสรุปผู้บริหาร", { heading: HeadingLevel.HEADING_1 }),
        ...markdownToText(model.summaryMarkdown).split(/\n+/).filter(Boolean).map((line) => docParagraph(line)),
        ...model.sections.flatMap((section) => [docParagraph(section.title, { heading: HeadingLevel.HEADING_1 }), docParagraph(section.body), ...section.bullets.map((bullet) => docParagraph(bullet, { bullet: true }))]),
        ...docTable("Metric Table", ["metric", "value"], metricRows),
        ...model.tables.flatMap((table) => docTable(table.title, table.columns, table.rows)),
        docParagraph("Recommendations", { heading: HeadingLevel.HEADING_1 }),
        ...model.recommendations.map((item) => docParagraph(`[${item.priority}] ${item.title}: ${item.detail}`, { bullet: true })),
        docParagraph("Risks", { heading: HeadingLevel.HEADING_1 }),
        ...model.risks.map((item) => docParagraph(`[${item.level}] ${item.title}: ${item.mitigation}`, { bullet: true })),
        docParagraph("Appendix", { heading: HeadingLevel.HEADING_1 }),
        docParagraph(`${model.aiStatus} · Data shape: ${model.appendix.dataShape}`),
        docParagraph(model.appendix.sourcePreview.slice(0, 3000)),
      ],
    }],
  });
  return Buffer.from(await Packer.toBuffer(document));
}

function addPptTitle(slide: any, model: ReportDocumentModel, title: string): void {
  slide.addText(title, { x: 0.55, y: 0.35, w: 12.2, h: 0.45, fontFace: "Garuda", fontSize: 22, bold: true, color: model.theme.accentDark.replace("#", "") });
}

function addPptBars(slide: any, chart: ReportChart, model: ReportDocumentModel, yStart = 1.35): void {
  const max = maxChartValue(chart);
  chart.data.slice(0, 7).forEach((item, index) => {
    const y = yStart + index * 0.45;
    const width = Math.max(0.2, Math.abs(item.value) / max * 6.8);
    slide.addText(item.label, { x: 0.8, y, w: 2.4, h: 0.24, fontFace: "Garuda", fontSize: 10, color: "33435C", fit: "shrink" });
    slide.addShape("rect", { x: 3.35, y: y + 0.04, w: 6.8, h: 0.16, fill: { color: "EDF2F8" }, line: { color: "EDF2F8" } });
    slide.addShape("rect", { x: 3.35, y: y + 0.04, w: width, h: 0.16, fill: { color: model.theme.accentColor.replace("#", "") }, line: { color: model.theme.accentColor.replace("#", "") } });
    slide.addText(String(item.value), { x: 10.35, y, w: 1.25, h: 0.24, fontFace: "Garuda", fontSize: 10, color: "475870", align: "right" });
  });
}

function addPptFlowSlide(pptx: any, model: ReportDocumentModel): void {
  const slide = pptx.addSlide();
  addPptTitle(slide, model, model.flow.title);
  slide.addText(model.flow.description, { x: 0.75, y: 0.9, w: 11.7, h: 0.35, fontFace: "Garuda", fontSize: 12, color: "5D6980", fit: "shrink" });
  const nodes = model.flow.nodes.slice(0, 6);
  nodes.forEach((node, index) => {
    const x = 0.72 + index * 2.08;
    const y = 1.55;
    slide.addShape("roundRect", { x, y, w: 1.72, h: 2.75, rectRadius: 0.08, fill: { color: "F8FBFF" }, line: { color: "D9E6F7" } });
    slide.addShape("roundRect", { x: x + 0.16, y: y + 0.18, w: 0.42, h: 0.34, rectRadius: 0.04, fill: { color: model.theme.accentColor.replace("#", "") }, line: { color: model.theme.accentColor.replace("#", "") } });
    slide.addText(String(index + 1), { x: x + 0.16, y: y + 0.23, w: 0.42, h: 0.18, fontFace: "Garuda", fontSize: 9, bold: true, color: "FFFFFF", align: "center", fit: "shrink" });
    slide.addText(node.kind.toUpperCase(), { x: x + 0.68, y: y + 0.22, w: 0.78, h: 0.18, fontFace: "Garuda", fontSize: 7, bold: true, color: model.theme.accentDark.replace("#", ""), fit: "shrink" });
    slide.addText(node.label, { x: x + 0.16, y: y + 0.72, w: 1.38, h: 0.42, fontFace: "Garuda", fontSize: 12, bold: true, color: "172033", fit: "shrink" });
    slide.addText(node.detail, { x: x + 0.16, y: y + 1.22, w: 1.38, h: 1.0, fontFace: "Garuda", fontSize: 8.5, color: "52627A", fit: "shrink", breakLine: false });
    slide.addText(node.status, { x: x + 0.16, y: y + 2.36, w: 1.38, h: 0.18, fontFace: "Garuda", fontSize: 7.5, bold: true, color: "0F8A64", fit: "shrink" });
    if (index < nodes.length - 1) slide.addText("→", { x: x + 1.77, y: y + 1.2, w: 0.22, h: 0.24, fontFace: "Garuda", fontSize: 14, bold: true, color: model.theme.accentDark.replace("#", "") });
  });
  slide.addText(model.flow.edges.map((edge) => `${flowNodeLabel(model, edge.from)} → ${flowNodeLabel(model, edge.to)}${edge.label ? ` · ${edge.label}` : ""}`).join("\n"), { x: 0.78, y: 4.75, w: 11.7, h: 1.25, fontFace: "Garuda", fontSize: 9, color: "475870", fit: "shrink", breakLine: false });
}

async function renderPptx(model: ReportDocumentModel): Promise<Buffer> {
  const PptxGenJS = require("pptxgenjs") as new () => any;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "CherryFlow";
  pptx.subject = model.fileName;
  pptx.title = model.title;
  pptx.company = model.department;
  pptx.theme = { headFontFace: "Garuda", bodyFontFace: "Garuda" };

  let slide = pptx.addSlide();
  slide.background = { color: model.theme.accentDark.replace("#", "") };
  slide.addText(model.theme.name, { x: 0.75, y: 0.8, w: 7, h: 0.35, fontFace: "Garuda", fontSize: 13, bold: true, color: "DDEBFF" });
  slide.addText(model.title, { x: 0.75, y: 1.45, w: 11.8, h: 1.1, fontFace: "Garuda", fontSize: 36, bold: true, color: "FFFFFF", fit: "shrink" });
  slide.addText(`${model.subtitle}\n${model.department} · ${model.fileName} · ${formatDate(model.generatedAt)}`, { x: 0.78, y: 2.75, w: 10.8, h: 1.1, fontFace: "Garuda", fontSize: 15, color: "EAF2FF", breakLine: false });

  slide = pptx.addSlide();
  addPptTitle(slide, model, "Executive Dashboard");
  model.kpis.slice(0, 6).forEach((kpi, index) => {
    const x = 0.75 + (index % 3) * 4.15;
    const y = 1.15 + Math.floor(index / 3) * 1.45;
    slide.addShape("roundRect", { x, y, w: 3.65, h: 1.1, rectRadius: 0.08, fill: { color: "F8FBFF" }, line: { color: "D9E6F7" } });
    slide.addText(kpi.label, { x: x + 0.18, y: y + 0.14, w: 3.25, h: 0.22, fontFace: "Garuda", fontSize: 9, bold: true, color: "607089" });
    slide.addText(kpi.value, { x: x + 0.18, y: y + 0.4, w: 3.25, h: 0.32, fontFace: "Garuda", fontSize: 20, bold: true, color: model.theme.accentDark.replace("#", "") });
    slide.addText(kpi.detail, { x: x + 0.18, y: y + 0.78, w: 3.25, h: 0.2, fontFace: "Garuda", fontSize: 8, color: "63718A", fit: "shrink" });
  });

  addPptFlowSlide(pptx, model);

  for (const chart of model.charts.slice(0, 2)) {
    slide = pptx.addSlide();
    addPptTitle(slide, model, chart.title);
    slide.addText(chart.insight, { x: 0.75, y: 0.92, w: 11.6, h: 0.35, fontFace: "Garuda", fontSize: 13, color: "5D6980", fit: "shrink" });
    addPptBars(slide, chart, model);
  }

  slide = pptx.addSlide();
  addPptTitle(slide, model, "บทสรุปและ Insight");
  slide.addText(markdownToText(model.summaryMarkdown), { x: 0.75, y: 1.0, w: 5.8, h: 4.8, fontFace: "Garuda", fontSize: 14, color: "172033", fit: "shrink", breakLine: false });
  slide.addText(model.sections.flatMap((section) => section.bullets).slice(0, 8).map((item) => `• ${item}`).join("\n"), { x: 6.85, y: 1.0, w: 5.7, h: 4.8, fontFace: "Garuda", fontSize: 13, color: "172033", fit: "shrink", breakLine: false });

  slide = pptx.addSlide();
  addPptTitle(slide, model, "Recommendations & Next Steps");
  slide.addText(model.recommendations.map((item) => `• [${item.priority}] ${item.title}: ${item.detail}`).join("\n"), { x: 0.85, y: 1.1, w: 11.5, h: 4.2, fontFace: "Garuda", fontSize: 14, color: "172033", fit: "shrink", breakLine: false });

  slide = pptx.addSlide();
  addPptTitle(slide, model, "Appendix");
  slide.addText(`${model.aiStatus}\nData shape: ${model.appendix.dataShape}\n\n${model.appendix.sourcePreview.slice(0, 1600)}`, { x: 0.75, y: 1.05, w: 11.8, h: 5.1, fontFace: "Garuda", fontSize: 11, color: "172033", fit: "shrink", breakLine: false });

  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(output as Buffer);
}

export async function renderReport(model: ReportDocumentModel, format: ReportFormat): Promise<RenderedReport> {
  const baseName = safeReportSlug(model.title);
  if (format === "html") return { fileName: `${baseName}.html`, mimeType: mimeTypes.html, content: renderHtml(model) };
  if (format === "docx") return { fileName: `${baseName}.docx`, mimeType: mimeTypes.docx, content: await renderDocx(model) };
  if (format === "pptx") return { fileName: `${baseName}.pptx`, mimeType: mimeTypes.pptx, content: await renderPptx(model) };
  return { fileName: `${baseName}.pdf`, mimeType: mimeTypes.pdf, content: await renderPdf(model) };
}
