import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultTheme, sanitizeSlug, validateUiSchema, type UiSchema, type WorkflowContract } from "./index.js";

test("slug normalization", () => {
  assert.equal(sanitizeSlug("Sales Report 2026"), "sales-report-2026");
});

const workflow: WorkflowContract = {
  id: "report",
  name: "Report",
  description: "Generate a report",
  inputs: [{ name: "source", label: "Source", type: "file", required: true }],
  outputs: [{ name: "result", label: "Result", type: "markdown" }],
};

test("validates a complete generated website schema", () => {
  const schema: UiSchema = {
    version: "1.0",
    workflowId: "report",
    meta: { name: "Report Website" },
    theme: createDefaultTheme(),
    page: {
      title: "Report Website",
      layout: "full-width",
      components: [
        { id: "nav", type: "navbar", brand: "CherryFlow", items: [{ label: "เริ่มใช้งาน", target: "#form" }] },
        { id: "hero", type: "hero", title: "Create reports", align: "center" },
        { id: "form", type: "workflow-form", fields: ["source"], submitLabel: "Run" },
        { id: "output", type: "workflow-output", bindings: ["result"] },
        { id: "footer", type: "footer", brand: "CherryFlow" },
      ],
    },
  };
  assert.deepEqual(validateUiSchema(schema, workflow), { valid: true, errors: [] });
});

test("rejects unsafe website navigation targets", () => {
  const schema: UiSchema = {
    version: "1.0",
    workflowId: "report",
    meta: { name: "Unsafe" },
    theme: createDefaultTheme(),
    page: {
      title: "Unsafe",
      layout: "centered",
      components: [
        { id: "nav", type: "navbar", brand: "Unsafe", items: [{ label: "External", target: "javascript:alert(1)" }] },
        { id: "form", type: "workflow-form", fields: ["source"], submitLabel: "Run" },
        { id: "output", type: "workflow-output", bindings: ["result"] },
      ],
    },
  };
  assert.equal(validateUiSchema(schema, workflow).valid, false);
});
