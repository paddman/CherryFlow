import assert from "node:assert/strict";
import test from "node:test";
import { parseAiTaskResponse, runAiTask } from "./task-ai.js";

test("parses JSON returned inside a Markdown fence", () => {
  const parsed = parseAiTaskResponse(`\n\`\`\`json\n{"result":"draft","summary":"short","checklist":["review"],"nextSteps":"- approve"}\n\`\`\`\n`);
  assert.equal(parsed?.result, "draft");
  assert.equal(parsed?.summary, "short");
});

test("runs reusable task with deterministic fallback when no model provider is enabled", async () => {
  const output = await runAiTask({
    workflowInputs: {},
    config: {
      inputNode: "input",
      taskName: "Project Status Report",
      role: "PMO Analyst",
      instructions: "Summarize status and risks.",
      inputLabels: { projectName: "ชื่อโครงการ", status: "สถานะ" },
    },
    dependencies: {
      input: { projectName: "CherryFlow", status: "กำลังพัฒนา" },
    },
  }, { CHERRYFLOW_AI_PROVIDER: "local" });

  assert.match(output.result, /Project Status Report/);
  assert.match(output.result, /CherryFlow/);
  assert.equal(output.aiStatus, "deterministic-fallback");
  assert.equal(output.checklist.length, 3);
});
