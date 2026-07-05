import assert from "node:assert/strict";
import test from "node:test";
import type { ExtractedFileContent } from "./file-content.js";
import { computeMetrics } from "./report-ai.js";
import { buildReportDocument, normalizeReportTemplate } from "./report-document.js";

test("normalizes report template aliases", () => {
  assert.equal(normalizeReportTemplate("dashboard"), "dashboard");
  assert.equal(normalizeReportTemplate("slides"), "presentation");
  assert.equal(normalizeReportTemplate("web"), "interactive");
  assert.equal(normalizeReportTemplate("unknown"), "auto");
});

test("builds a corporate report document with dashboard, chart, sections, and table from rows", () => {
  const extracted: ExtractedFileContent = {
    kind: "rows",
    columns: ["department", "amount", "score"],
    rows: [
      { department: "ops", amount: 100, score: 8 },
      { department: "ops", amount: 200, score: 7 },
      { department: "tech", amount: 300, score: 9 },
    ],
    truncated: false,
  };
  const report = buildReportDocument({
    projectName: "Sales Report",
    department: "technology",
    notes: "focus on KPI",
    fileName: "sales.csv",
    extracted,
    metrics: computeMetrics(extracted, { fileName: "sales.csv" }),
    summaryMarkdown: "# Sales Report\n\n- tech has highest amount",
    usedAi: true,
    outputFormat: "html",
    reportTemplate: "auto",
  });
  assert.equal(report.kind, "report");
  assert.equal(report.template, "interactive");
  assert.ok(report.kpis.length >= 3);
  assert.ok(report.charts.some((chart) => chart.id === "category-performance"));
  assert.ok(report.sections.some((section) => section.id === "dashboard-analysis"));
  assert.equal(report.tables[0]?.rows.length, 3);
  assert.ok(report.tableOfContents.some((item) => item.id === "dashboard"));
  assert.ok(report.tableOfContents.some((item) => item.id === "workflow-flow"));
  assert.deepEqual(report.flow.nodes.map((node) => node.id), [
    "source-input",
    "content-extract",
    "metric-analysis",
    "report-compose",
    "render-output",
    "publish-result",
  ]);
});

test("builds a document-analysis report for extracted text", () => {
  const extracted: ExtractedFileContent = {
    kind: "text",
    text: "AI workflow report report KPI dashboard recommendation action action",
    truncated: false,
  };
  const report = buildReportDocument({
    projectName: "Document Report",
    department: "management",
    notes: "",
    fileName: "brief.pdf",
    extracted,
    metrics: computeMetrics(extracted, { fileName: "brief.pdf" }),
    summaryMarkdown: "# Document Report",
    usedAi: false,
    fallbackReason: "test",
    outputFormat: "pdf",
    reportTemplate: "corporate",
  });
  assert.ok(report.charts.some((chart) => chart.id === "term-frequency"));
  assert.ok(report.risks.some((risk) => risk.title.includes("AI")));
  assert.equal(report.appendix.dataShape.includes("characters"), true);
});
