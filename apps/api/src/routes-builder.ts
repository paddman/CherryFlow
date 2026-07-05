import type { IncomingMessage, ServerResponse } from "node:http";
import { validateWorkflowGraph, type WorkflowGraph } from "@cherryflow/workflow-engine";
import type { UiSchema, WorkflowInputValues } from "@cherryflow/ui-schema";
import { validateUiSchema } from "@cherryflow/ui-schema";
import { matchWorkflow, readJson, send } from "./http-utils.js";
import { moduleRegistry } from "./module-registry.js";
import { planUiSchema } from "./planner.js";
import { startCanvasRun } from "./run-service.js";
import { getCanvas, saveCanvas } from "./store.js";
import type { CanvasEdge, CanvasFlow, CanvasNode } from "./types.js";
import { getWorkflow, listWorkflows } from "./workflows.js";

function canvasFromGraph(workflowId: string, graph: WorkflowGraph): CanvasFlow {
  const nodes: CanvasNode[] = graph.nodes.map((node, index) => ({
    id: node.id,
    moduleType: node.moduleType,
    label: node.id,
    position: { x: 120 + (index % 2) * 280, y: 90 + index * 110 },
    config: node.config ?? {},
  }));
  const edges: CanvasEdge[] = graph.edges.map((edge) => ({
    id: `${edge.from}-${edge.to}`,
    from: edge.from,
    to: edge.to,
  }));
  return { workflowId, graph, nodes, edges, updatedAt: new Date().toISOString() };
}

function graphFromCanvas(workflowId: string, nodes: CanvasNode[], edges: CanvasEdge[], outputNodeId?: string): CanvasFlow {
  const graph: WorkflowGraph = {
    version: "1.0",
    nodes: nodes.map((node) => ({
      id: node.id,
      moduleType: node.moduleType,
      config: node.config ?? {},
    })),
    edges: edges.map((edge) => ({ from: edge.from, to: edge.to })),
    outputNodeId: outputNodeId || nodes.at(-1)?.id || "",
  };
  return { workflowId, graph, nodes, edges, updatedAt: new Date().toISOString() };
}

function canvasPayload(canvas: CanvasFlow) {
  return {
    canvas,
    validation: validateWorkflowGraph(canvas.graph, moduleRegistry),
    modules: moduleRegistry.list(),
  };
}

export async function handleBuilderRoutes(request: IncomingMessage, response: ServerResponse, pathname: string): Promise<boolean> {
  if (request.method === "GET" && pathname === "/api/modules") {
    send(response, 200, { modules: moduleRegistry.list() });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/workflows") {
    send(response, 200, { workflows: listWorkflows() });
    return true;
  }

  const graphGet = matchWorkflow(pathname, "/graph");
  if (request.method === "GET" && graphGet) {
    const definition = getWorkflow(decodeURIComponent(graphGet[1] ?? ""));
    if (!definition) send(response, 404, { error: "Workflow not found" });
    else send(response, 200, { graph: definition.graph, validation: validateWorkflowGraph(definition.graph, moduleRegistry) });
    return true;
  }

  const canvas = matchWorkflow(pathname, "/canvas");
  if (canvas) {
    const workflowId = decodeURIComponent(canvas[1] ?? "");
    const definition = getWorkflow(workflowId);
    if (!definition) send(response, 404, { error: "Workflow not found" });
    else if (request.method === "GET") {
      send(response, 200, canvasPayload(await getCanvas(workflowId) ?? canvasFromGraph(workflowId, definition.graph)));
    } else if (request.method === "PUT") {
      const body = await readJson<{ nodes?: CanvasNode[]; edges?: CanvasEdge[]; outputNodeId?: string }>(request);
      if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) send(response, 400, { error: "nodes and edges are required" });
      else {
        const next = graphFromCanvas(workflowId, body.nodes, body.edges, body.outputNodeId);
        send(response, 200, canvasPayload(await saveCanvas(next)));
      }
    } else return false;
    return true;
  }

  const canvasValidate = matchWorkflow(pathname, "/canvas/validate");
  if (request.method === "POST" && canvasValidate) {
    const workflowId = decodeURIComponent(canvasValidate[1] ?? "");
    const definition = getWorkflow(workflowId);
    if (!definition) send(response, 404, { error: "Workflow not found" });
    else {
      const body = await readJson<{ nodes?: CanvasNode[]; edges?: CanvasEdge[]; outputNodeId?: string }>(request);
      if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) send(response, 400, { error: "nodes and edges are required" });
      else send(response, 200, canvasPayload(graphFromCanvas(workflowId, body.nodes, body.edges, body.outputNodeId)));
    }
    return true;
  }

  const canvasRun = matchWorkflow(pathname, "/canvas/run");
  if (request.method === "POST" && canvasRun) {
    const workflowId = decodeURIComponent(canvasRun[1] ?? "");
    const definition = getWorkflow(workflowId);
    if (!definition) send(response, 404, { error: "Workflow not found" });
    else {
      const body = await readJson<{ inputs?: WorkflowInputValues; nodes?: CanvasNode[]; edges?: CanvasEdge[]; outputNodeId?: string }>(request);
      const canvasFlow = Array.isArray(body.nodes) && Array.isArray(body.edges)
        ? graphFromCanvas(workflowId, body.nodes, body.edges, body.outputNodeId)
        : await getCanvas(workflowId) ?? canvasFromGraph(workflowId, definition.graph);
      const validation = validateWorkflowGraph(canvasFlow.graph, moduleRegistry);
      if (!validation.valid) send(response, 422, { error: "Invalid workflow graph", validation });
      else send(response, 202, { run: await startCanvasRun(workflowId, canvasFlow.graph, body.inputs ?? {}), validation });
    }
    return true;
  }

  const workflowGet = matchWorkflow(pathname);
  if (request.method === "GET" && workflowGet) {
    const definition = getWorkflow(decodeURIComponent(workflowGet[1] ?? ""));
    if (!definition) send(response, 404, { error: "Workflow not found" });
    else send(response, 200, definition.contract);
    return true;
  }

  const generate = matchWorkflow(pathname, "/ui/generate");
  if (request.method === "POST" && generate) {
    const definition = getWorkflow(decodeURIComponent(generate[1] ?? ""));
    if (!definition) send(response, 404, { error: "Workflow not found" });
    else {
      const body = await readJson<{ prompt?: string }>(request);
      const planned = await planUiSchema(body.prompt ?? "", definition.contract);
      send(response, 200, { ...planned, validation: validateUiSchema(planned.schema, definition.contract) });
    }
    return true;
  }

  const refine = matchWorkflow(pathname, "/ui/refine");
  if (request.method === "POST" && refine) {
    const definition = getWorkflow(decodeURIComponent(refine[1] ?? ""));
    if (!definition) send(response, 404, { error: "Workflow not found" });
    else {
      const body = await readJson<{ prompt?: string; schema?: UiSchema }>(request);
      if (!body.schema) send(response, 400, { error: "schema is required" });
      else {
        const planned = await planUiSchema(body.prompt ?? "", definition.contract, body.schema);
        send(response, 200, { ...planned, validation: validateUiSchema(planned.schema, definition.contract) });
      }
    }
    return true;
  }

  const validate = matchWorkflow(pathname, "/ui/validate");
  if (request.method === "POST" && validate) {
    const definition = getWorkflow(decodeURIComponent(validate[1] ?? ""));
    if (!definition) send(response, 404, { error: "Workflow not found" });
    else {
      const body = await readJson<{ schema?: UiSchema }>(request);
      if (!body.schema) send(response, 400, { error: "schema is required" });
      else send(response, 200, validateUiSchema(body.schema, definition.contract));
    }
    return true;
  }

  return false;
}
