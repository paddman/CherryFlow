import assert from "node:assert/strict";
import test from "node:test";
import { validateWorkflowGraph } from "@cherryflow/workflow-engine";
import { moduleRegistry } from "./module-registry.js";
import { getWorkflow, listWorkflowTemplates, listWorkflows } from "./workflows.js";

test("ships a broad set of runnable workflow templates", () => {
  const workflows = listWorkflows();
  const templates = listWorkflowTemplates();
  assert.ok(workflows.length >= 31, `expected at least 31 workflows, received ${workflows.length}`);
  assert.equal(templates.length, workflows.length);
  assert.equal(new Set(workflows.map((workflow) => workflow.id)).size, workflows.length);
  assert.ok(templates.some((template) => template.category === "hr"));
  assert.ok(templates.some((template) => template.category === "it-security"));
  assert.ok(templates.some((template) => template.requiresFile));
});

test("every shipped template has a valid executable graph", () => {
  for (const template of listWorkflowTemplates()) {
    const definition = getWorkflow(template.id);
    assert.ok(definition, `missing workflow definition for ${template.id}`);
    const validation = validateWorkflowGraph(definition.graph, moduleRegistry);
    assert.equal(validation.valid, true, `${template.id}: ${validation.errors.join("; ")}`);
  }
});
