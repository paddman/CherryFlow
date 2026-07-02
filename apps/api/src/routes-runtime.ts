import type { IncomingMessage, ServerResponse } from "node:http";
import type { WorkflowInputValues } from "@cherryflow/ui-schema";
import { matchWorkflow, readJson, send } from "./http-utils.js";
import { startRun } from "./run-service.js";
import { getPublishedApp, getRun } from "./store.js";
import { getWorkflow } from "./workflows.js";

export async function handleRuntimeRoutes(request: IncomingMessage, response: ServerResponse, pathname: string): Promise<boolean> {
  const workflowRun = matchWorkflow(pathname, "/runs");
  if (request.method === "POST" && workflowRun) {
    const body = await readJson<{ inputs?: WorkflowInputValues }>(request);
    send(response, 202, { run: await startRun(decodeURIComponent(workflowRun[1] ?? ""), body.inputs ?? {}) });
    return true;
  }

  const runMatch = pathname.match(/^\/api\/runs\/([^/]+)$/);
  if (request.method === "GET" && runMatch) {
    const run = await getRun(decodeURIComponent(runMatch[1] ?? ""));
    if (!run) send(response, 404, { error: "Run not found" });
    else send(response, 200, { run });
    return true;
  }

  const appMatch = pathname.match(/^\/api\/apps\/([^/]+)$/);
  if (request.method === "GET" && appMatch) {
    const published = await getPublishedApp(decodeURIComponent(appMatch[1] ?? ""));
    const definition = published ? getWorkflow(published.app.workflowId) : undefined;
    if (!published || !definition) send(response, 404, { error: "Published app not found" });
    else send(response, 200, { app: published.app, schema: published.version.schema, workflow: definition.contract });
    return true;
  }

  const appRunMatch = pathname.match(/^\/api\/apps\/([^/]+)\/run$/);
  if (request.method === "POST" && appRunMatch) {
    const published = await getPublishedApp(decodeURIComponent(appRunMatch[1] ?? ""));
    if (!published) send(response, 404, { error: "Published app not found" });
    else {
      const body = await readJson<{ inputs?: WorkflowInputValues }>(request);
      send(response, 202, { run: await startRun(published.app.workflowId, body.inputs ?? {}) });
    }
    return true;
  }

  return false;
}
