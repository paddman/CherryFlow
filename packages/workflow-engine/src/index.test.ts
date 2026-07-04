import assert from "node:assert/strict";
import test from "node:test";
import { executeWorkflowGraph, ModuleRegistry, validateWorkflowGraph, type WorkflowGraph } from "./index.js";

const registry = new ModuleRegistry()
  .register({
    type: "input",
    label: "Input",
    description: "Expose workflow inputs",
    run: ({ workflowInputs }) => workflowInputs,
  })
  .register({
    type: "double",
    label: "Double",
    description: "Double a numeric value",
    run: ({ dependencies }) => ({ value: Number(dependencies.input?.value ?? 0) * 2 }),
  });

const graph: WorkflowGraph = {
  version: "1.0",
  nodes: [
    { id: "input", moduleType: "input" },
    { id: "result", moduleType: "double" },
  ],
  edges: [{ from: "input", to: "result" }],
  outputNodeId: "result",
};

test("validates and orders an acyclic workflow", () => {
  assert.deepEqual(validateWorkflowGraph(graph, registry), {
    valid: true,
    errors: [],
    order: ["input", "result"],
  });
});

test("rejects unknown modules and cycles", () => {
  const invalid: WorkflowGraph = {
    version: "1.0",
    nodes: [
      { id: "a", moduleType: "missing" },
      { id: "b", moduleType: "input" },
    ],
    edges: [
      { from: "a", to: "b" },
      { from: "b", to: "a" },
    ],
    outputNodeId: "b",
  };
  const result = validateWorkflowGraph(invalid, registry);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Unknown module type/);
  assert.match(result.errors.join(" "), /acyclic/);
});

test("executes modules in dependency order", async () => {
  const result = await executeWorkflowGraph(graph, registry, { value: 21 });
  assert.deepEqual(result.output, { value: 42 });
  assert.equal(result.events.at(-1)?.status, "completed");
});
