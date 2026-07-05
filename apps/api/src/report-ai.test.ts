import assert from "node:assert/strict";
import test from "node:test";
import { computeMetrics, summarizeReport } from "./report-ai.js";
import type { ExtractedFileContent } from "./file-content.js";

test("computeMetrics derives real row/column counts and numeric sums from parsed data", () => {
  const extracted: ExtractedFileContent = {
    kind: "rows",
    columns: ["department", "budget"],
    rows: [
      { department: "operations", budget: 5000 },
      { department: "technology", budget: 7200 },
    ],
    truncated: false,
  };
  const metrics = computeMetrics(extracted, { fileName: "budget.xlsx" });
  const byName = Object.fromEntries(metrics.map((item) => [item.metric, item.value]));
  assert.equal(byName["จำนวนแถวข้อมูล"], 2);
  assert.equal(byName["จำนวนคอลัมน์"], 2);
  assert.equal(byName["budget (ผลรวม)"], 12200);
  assert.equal(byName["budget (ค่าเฉลี่ย)"], 6100);
});

test("computeMetrics derives word/line counts for plain text content", () => {
  const extracted: ExtractedFileContent = { kind: "text", text: "line one\nline two has more words\n", truncated: false };
  const metrics = computeMetrics(extracted, { fileName: "notes.txt" });
  const byName = Object.fromEntries(metrics.map((item) => [item.metric, item.value]));
  assert.equal(byName["จำนวนบรรทัดที่มีข้อความ"], 2);
  assert.equal(byName["จำนวนคำโดยประมาณ"], 7);
});

test("summarizeReport falls back to a deterministic, data-grounded summary when no AI provider is configured", async () => {
  const extracted: ExtractedFileContent = { kind: "text", text: "some content", truncated: false };
  const metrics = computeMetrics(extracted, { fileName: "notes.txt" });
  const result = await summarizeReport(
    { projectName: "Test Project", department: "operations", notes: "", fileName: "notes.txt", extracted, metrics },
    {},
  );
  assert.equal(result.usedAi, false);
  assert.match(result.summary, /Test Project/);
  assert.match(result.summary, /notes\.txt/);
});
