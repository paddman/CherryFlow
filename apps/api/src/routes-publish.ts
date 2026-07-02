import type { IncomingMessage, ServerResponse } from "node:http";
import type { UiSchema } from "@cherryflow/ui-schema";
import { sanitizeSlug, validateUiSchema } from "@cherryflow/ui-schema";
import { matchWorkflow, readJson, send } from "./http-utils.js";
import { getVersion, listVersions, publishSchema, saveVersion } from "./store.js";
import { getWorkflow } from "./workflows.js";

export async function handlePublishRoutes(request: IncomingMessage, response: ServerResponse, pathname: string): Promise<boolean> {
  const save = matchWorkflow(pathname, "/ui/save");
  if (request.method === "POST" && save) {
    const workflowId = decodeURIComponent(save[1] ?? "");
    const definition = getWorkflow(workflowId);
    const body = await readJson<{ schema?: UiSchema; prompt?: string }>(request);
    if (!definition) send(response, 404, { error: "Workflow not found" });
    else if (!body.schema) send(response, 400, { error: "schema is required" });
    else {
      const validation = validateUiSchema(body.schema, definition.contract);
      if (!validation.valid) send(response, 422, { error: "Invalid schema", validation });
      else send(response, 201, { version: await saveVersion(workflowId, body.schema, body.prompt ?? "") });
    }
    return true;
  }

  const versions = matchWorkflow(pathname, "/ui/versions");
  if (request.method === "GET" && versions) {
    send(response, 200, { versions: await listVersions(decodeURIComponent(versions[1] ?? "")) });
    return true;
  }

  const publish = matchWorkflow(pathname, "/ui/publish");
  if (request.method === "POST" && publish) {
    const workflowId = decodeURIComponent(publish[1] ?? "");
    const definition = getWorkflow(workflowId);
    const body = await readJson<{ schema?: UiSchema; prompt?: string; slug?: string }>(request);
    if (!definition) send(response, 404, { error: "Workflow not found" });
    else if (!body.schema) send(response, 400, { error: "schema is required" });
    else {
      const validation = validateUiSchema(body.schema, definition.contract);
      if (!validation.valid) send(response, 422, { error: "Invalid schema", validation });
      else send(response, 201, await publishSchema(workflowId, body.schema, body.prompt ?? "", sanitizeSlug(body.slug ?? body.schema.meta.name)));
    }
    return true;
  }

  const rollback = matchWorkflow(pathname, "/ui/rollback");
  if (request.method === "POST" && rollback) {
    const workflowId = decodeURIComponent(rollback[1] ?? "");
    const body = await readJson<{ versionId?: string }>(request);
    const source = body.versionId ? await getVersion(body.versionId) : undefined;
    if (!source || source.workflowId !== workflowId) send(response, 404, { error: "Version not found" });
    else send(response, 201, { version: await saveVersion(workflowId, source.schema, `Rollback from ${source.id}`) });
    return true;
  }

  return false;
}
