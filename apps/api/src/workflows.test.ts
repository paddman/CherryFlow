import assert from "node:assert/strict";
import test from "node:test";
import { validateWorkflowGraph } from "@cherryflow/workflow-engine";
import { moduleRegistry } from "./module-registry.js";
import { getWorkflow } from "./workflows.js";

test("report generator graph includes the Qwen PDF skill flow node", () => {
  const definition = getWorkflow("report-generator");
  assert.ok(definition);
  assert.ok(definition.graph.nodes.some((node) => node.id === "qwen_pdf" && node.moduleType === "report.qwen_pdf"));
  assert.ok(definition.graph.edges.some((edge) => edge.from === "compose" && edge.to === "qwen_pdf"));
  assert.ok(definition.graph.edges.some((edge) => edge.from === "qwen_pdf" && edge.to === "output"));

  const validation = validateWorkflowGraph(definition.graph, moduleRegistry);
  assert.equal(validation.valid, true, validation.errors.join("; "));
  assert.deepEqual(validation.order, ["input", "inspect", "compose", "qwen_pdf", "output"]);
});
