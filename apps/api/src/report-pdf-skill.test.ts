import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildSkillPdfInstruction,
  buildSkillPdfReport,
  extractedContentToSkillText,
  reportPdfSkillMode,
} from "./report-pdf-skill.js";
import type { ExtractedFileContent } from "./file-content.js";

test("serializes extracted rows as CSV text for the Qwen PDF skill", () => {
  const extracted: ExtractedFileContent = {
    kind: "rows",
    columns: ["name", "amount"],
    rows: [{ name: "Somchai, Ltd.", amount: 1200 }],
    truncated: false,
  };
  assert.equal(extractedContentToSkillText(extracted), 'name,amount\n"Somchai, Ltd.",1200');
});

test("normalizes Qwen PDF skill modes", () => {
  assert.equal(reportPdfSkillMode({ CHERRYFLOW_REPORT_PDF_SKILL: "off" }), "disabled");
  assert.equal(reportPdfSkillMode({ CHERRYFLOW_REPORT_PDF_SKILL: "required" }), "required");
  assert.equal(reportPdfSkillMode({}), "auto");
});

test("builds a PDF by invoking a skill-compatible Python script", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "cherryflow-pdf-skill-test-"));
  try {
    const scriptPath = path.join(tempDir, "fake_skill.py");
    await writeFile(scriptPath, [
      "import argparse",
      "parser = argparse.ArgumentParser()",
      "parser.add_argument('--data', required=True)",
      "parser.add_argument('--instruction', required=True)",
      "parser.add_argument('--out', required=True)",
      "parser.add_argument('--brand')",
      "parser.add_argument('--base-url')",
      "parser.add_argument('--model')",
      "args = parser.parse_args()",
      "open(args.out, 'wb').write(b'%PDF-1.4\\n1 0 obj <<>> endobj\\n%%EOF\\n')",
      "print('fake skill built pdf')",
    ].join("\n"), "utf8");

    const extracted: ExtractedFileContent = {
      kind: "text",
      text: "Traffic volume rose during office hours.",
      truncated: false,
    };
    const result = await buildSkillPdfReport({
      projectName: "Network Daily",
      department: "operations",
      notes: "show dashboard",
      fileName: "traffic.csv",
      extracted,
      scriptPath,
      pythonBin: "python3",
      env: { ...process.env, OPENAI_BASE_URL: "http://127.0.0.1:1/v1", OPENAI_MODEL: "fake-qwen" },
      timeoutMs: 10_000,
    });
    assert.equal(result.mimeType, "application/pdf");
    assert.equal(result.content.subarray(0, 4).toString("utf8"), "%PDF");
    assert.match(result.fileName, /network-daily-qwen-report\.pdf/);
    assert.match(result.diagnostics, /fake skill built pdf/);
    assert.match(buildSkillPdfInstruction({
      projectName: "Network Daily",
      department: "operations",
      notes: "show dashboard",
      fileName: "traffic.csv",
    }), /Use only facts/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
