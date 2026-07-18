import assert from "node:assert/strict";
import test from "node:test";
import { createFlowPackage, normalizeCanvasImport } from "./flow-package.js";
import type { CanvasFlow } from "./types.js";

const rawFlow = {
  nodes: [
    { id: "input", moduleType: "core.input", label: "Input", position: { x: 10, y: 20 }, config: {} },
    { id: "output", moduleType: "core.output", label: "Output", position: { x: 30, y: 40 }, config: {} },
  ],
  edges: [{ id: "input-output", from: "input", to: "output" }],
  outputNodeId: "output",
};

test("normalizes a raw canvas JSON payload", () => {
  assert.deepEqual(normalizeCanvasImport(rawFlow), rawFlow);
});

test("normalizes an exported CherryFlow package", () => {
  const canvas: CanvasFlow = {
    workflowId: "report-generator",
    graph: {
      version: "1.0",
      nodes: rawFlow.nodes.map((node) => ({ id: node.id, moduleType: node.moduleType, config: node.config })),
      edges: rawFlow.edges.map((edge) => ({ from: edge.from, to: edge.to })),
      outputNodeId: "output",
    },
    nodes: rawFlow.nodes,
    edges: rawFlow.edges,
    updatedAt: new Date().toISOString(),
  };
  const exported = createFlowPackage(canvas, "Report Generator");
  assert.equal(exported.format, "cherryflow.flow");
  assert.equal(exported.formatVersion, 1);
  assert.deepEqual(normalizeCanvasImport(exported), rawFlow);
});

test("accepts React Flow source and target edge fields", () => {
  const imported = normalizeCanvasImport({
    nodes: rawFlow.nodes,
    edges: [{ id: "edge", source: "input", target: "output" }],
    outputNodeId: "output",
  });
  assert.deepEqual(imported.edges, [{ id: "edge", from: "input", to: "output" }]);
});

test("rejects unsupported versions and broken references", () => {
  assert.throws(
    () => normalizeCanvasImport({ format: "cherryflow.flow", formatVersion: 99, canvas: rawFlow }),
    /Unsupported flow format version/,
  );
  assert.throws(
    () => normalizeCanvasImport({ ...rawFlow, edges: [{ id: "broken", from: "missing", to: "output" }] }),
    /missing source node/,
  );
});
