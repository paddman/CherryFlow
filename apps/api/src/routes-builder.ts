import type { IncomingMessage, ServerResponse } from "node:http";
import { validateWorkflowGraph } from "@cherryflow/workflow-engine";
import type { UiSchema } from "@cherryflow/ui-schema";
import { validateUiSchema } from "@cherryflow/ui-schema";
import { matchWorkflow, readJson, send } from "./http-utils.js";
import { moduleRegistry } from "./module-registry.js";
import { planUiSchema } from "./planner.js";
import { getWorkflow, listWorkflows } from "./workflows.js";

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
