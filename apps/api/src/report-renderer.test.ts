import assert from "node:assert/strict";
import test from "node:test";
import { computeMetrics } from "./report-ai.js";
import { buildReportDocument, type ReportFormat } from "./report-document.js";
import { normalizeReportFormat, renderReport } from "./report-renderer.js";
import type { ExtractedFileContent } from "./file-content.js";

const extracted: ExtractedFileContent = {
  kind: "rows",
  columns: ["department", "amount"],
  rows: [
    { department: "ops", amount: 500 },
    { department: "tech", amount: 700 },
  ],
  truncated: false,
};

const model = buildReportDocument({
  projectName: "รายงานทดสอบ",
  department: "technology",
  fileName: "source.csv",
  notes: "เน้น KPI",
  extracted,
  metrics: computeMetrics(extracted, { fileName: "source.csv" }),
  summaryMarkdown: "# รายงานทดสอบ\n\n- ยอดรวมเพิ่มขึ้น",
  usedAi: true,
  outputFormat: "pdf",
  reportTemplate: "corporate",
});

test("normalizes common report format aliases", () => {
  assert.equal(normalizeReportFormat("PDF"), "pdf");
  assert.equal(normalizeReportFormat("html"), "html");
  assert.equal(normalizeReportFormat("word"), "docx");
  assert.equal(normalizeReportFormat("world"), "docx");
  assert.equal(normalizeReportFormat("powerpoint"), "pptx");
});

test("renders selectable report output formats", async () => {
  for (const format of ["html", "pdf", "docx", "pptx"] satisfies ReportFormat[]) {
    const rendered = await renderReport(model, format);
    assert.ok(rendered.fileName.endsWith(`.${format}`));
    if (format === "html") {
      assert.equal(typeof rendered.content, "string");
      assert.match(rendered.content as string, /<!doctype html>/);
      assert.match(rendered.content as string, /CherryFlow Report Workflow/);
      continue;
    }
    const bytes = Buffer.from(rendered.content);
    assert.ok(bytes.byteLength > 100);
    if (format === "pdf") assert.equal(bytes.subarray(0, 4).toString("utf8"), "%PDF");
    else assert.equal(bytes.subarray(0, 2).toString("utf8"), "PK");
  }
});
