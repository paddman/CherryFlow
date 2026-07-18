import type { CanvasEdge, CanvasFlow, CanvasNode } from "./types.js";

export const CHERRYFLOW_FLOW_FORMAT = "cherryflow.flow";
export const CHERRYFLOW_FLOW_FORMAT_VERSION = 1;

export interface CanvasImportPayload {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  outputNodeId?: string;
}

export interface CherryFlowPackage {
  format: typeof CHERRYFLOW_FLOW_FORMAT;
  formatVersion: typeof CHERRYFLOW_FLOW_FORMAT_VERSION;
  exportedAt: string;
  workflow: {
    id: string;
    name: string;
  };
  canvas: CanvasImportPayload;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
}

function normalizeNode(value: unknown, index: number): CanvasNode {
  const node = record(value, `nodes[${index}]`);
  const position = record(node.position, `nodes[${index}].position`);
  const config = node.config === undefined ? {} : record(node.config, `nodes[${index}].config`);
  return {
    id: nonEmptyString(node.id, `nodes[${index}].id`),
    moduleType: nonEmptyString(node.moduleType, `nodes[${index}].moduleType`),
    label: typeof node.label === "string" && node.label.trim() ? node.label : nonEmptyString(node.id, `nodes[${index}].id`),
    position: {
      x: finiteNumber(position.x, `nodes[${index}].position.x`),
      y: finiteNumber(position.y, `nodes[${index}].position.y`),
    },
    config,
  };
}

function normalizeEdge(value: unknown, index: number): CanvasEdge {
  const edge = record(value, `edges[${index}]`);
  const from = nonEmptyString(edge.from ?? edge.source, `edges[${index}].from`);
  const to = nonEmptyString(edge.to ?? edge.target, `edges[${index}].to`);
  return {
    id: typeof edge.id === "string" && edge.id.trim() ? edge.id : `${from}-${to}-${index}`,
    from,
    to,
  };
}

export function normalizeCanvasImport(payload: unknown): CanvasImportPayload {
  const root = record(payload, "flow file");

  if (root.format !== undefined && root.format !== CHERRYFLOW_FLOW_FORMAT) {
    throw new Error(`Unsupported flow format: ${String(root.format)}`);
  }
  if (root.formatVersion !== undefined && root.formatVersion !== CHERRYFLOW_FLOW_FORMAT_VERSION) {
    throw new Error(`Unsupported flow format version: ${String(root.formatVersion)}`);
  }

  const canvas = root.canvas === undefined ? root : record(root.canvas, "canvas");
  if (!Array.isArray(canvas.nodes) || !Array.isArray(canvas.edges)) {
    throw new Error("Flow JSON must contain canvas.nodes and canvas.edges arrays");
  }
  if (canvas.nodes.length === 0) throw new Error("Flow JSON must contain at least one node");
  if (canvas.nodes.length > 500) throw new Error("Flow JSON supports at most 500 nodes");
  if (canvas.edges.length > 2_000) throw new Error("Flow JSON supports at most 2,000 edges");

  const nodes = canvas.nodes.map(normalizeNode);
  const edges = canvas.edges.map(normalizeEdge);
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) throw new Error(`Duplicate node id: ${node.id}`);
    nodeIds.add(node.id);
  }
  for (const edge of edges) {
    if (!nodeIds.has(edge.from)) throw new Error(`Edge ${edge.id} references missing source node ${edge.from}`);
    if (!nodeIds.has(edge.to)) throw new Error(`Edge ${edge.id} references missing target node ${edge.to}`);
    if (edge.from === edge.to) throw new Error(`Edge ${edge.id} cannot connect a node to itself`);
  }

  const graph = canvas.graph && typeof canvas.graph === "object" && !Array.isArray(canvas.graph)
    ? canvas.graph as Record<string, unknown>
    : undefined;
  const outputNodeId = canvas.outputNodeId ?? graph?.outputNodeId;
  if (outputNodeId !== undefined && (typeof outputNodeId !== "string" || !nodeIds.has(outputNodeId))) {
    throw new Error(`outputNodeId references missing node ${String(outputNodeId)}`);
  }

  return outputNodeId ? { nodes, edges, outputNodeId } : { nodes, edges };
}

export function createFlowPackage(canvas: CanvasFlow, workflowName: string): CherryFlowPackage {
  return {
    format: CHERRYFLOW_FLOW_FORMAT,
    formatVersion: CHERRYFLOW_FLOW_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    workflow: {
      id: canvas.workflowId,
      name: workflowName,
    },
    canvas: {
      nodes: canvas.nodes,
      edges: canvas.edges,
      outputNodeId: canvas.graph.outputNodeId,
    },
  };
}
