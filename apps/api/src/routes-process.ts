import type { IncomingMessage, ServerResponse } from "node:http";
import { currentUser } from "./auth.js";
import { readJson, send } from "./http-utils.js";
import {
  createProcessFlow,
  deleteProcessFlow,
  getProcessFlow,
  listProcessFlows,
  updateProcessFlow,
} from "./store.js";
import type { ProcessFlow } from "./types.js";

function processFlowId(pathname: string): string | undefined {
  const match = pathname.match(/^\/api\/process-flows\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedTitle(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "Untitled Process Flow";
  return value.trim().slice(0, 180);
}

function processPayload(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function publicProcessFlow(flow: ProcessFlow) {
  return {
    id: flow.id,
    title: flow.title,
    payload: flow.payload,
    createdAt: flow.createdAt,
    updatedAt: flow.updatedAt,
  };
}

export async function handleProcessFlowRoutes(request: IncomingMessage, response: ServerResponse, pathname: string): Promise<boolean> {
  if (pathname !== "/api/process-flows" && !pathname.startsWith("/api/process-flows/")) return false;

  const user = await currentUser(request);
  if (!user) {
    send(response, 401, { error: "Authentication required" });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/process-flows") {
    send(response, 200, { userId: user.id, flows: (await listProcessFlows(user.id)).map(publicProcessFlow) });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/process-flows") {
    const body = await readJson<{ title?: unknown; payload?: unknown }>(request);
    const payload = processPayload(body.payload);
    if (!payload) {
      send(response, 400, { error: "payload must be a JSON object" });
      return true;
    }
    const now = new Date().toISOString();
    const created: ProcessFlow = {
      id: crypto.randomUUID(),
      ownerId: user.id,
      title: normalizedTitle(body.title),
      payload,
      createdAt: now,
      updatedAt: now,
    };
    send(response, 201, { flow: publicProcessFlow(await createProcessFlow(created)) });
    return true;
  }

  const id = processFlowId(pathname);
  if (!id) {
    send(response, 404, { error: "Process flow not found" });
    return true;
  }

  if (request.method === "GET") {
    const flow = await getProcessFlow(user.id, id);
    if (!flow) send(response, 404, { error: "Process flow not found" });
    else send(response, 200, { flow: publicProcessFlow(flow) });
    return true;
  }

  if (request.method === "PUT") {
    const body = await readJson<{ title?: unknown; payload?: unknown }>(request);
    const payload = processPayload(body.payload);
    if (!payload) {
      send(response, 400, { error: "payload must be a JSON object" });
      return true;
    }
    const updated = await updateProcessFlow(user.id, id, normalizedTitle(body.title), payload);
    if (!updated) send(response, 404, { error: "Process flow not found" });
    else send(response, 200, { flow: publicProcessFlow(updated) });
    return true;
  }

  if (request.method === "DELETE") {
    const deleted = await deleteProcessFlow(user.id, id);
    if (!deleted) send(response, 404, { error: "Process flow not found" });
    else send(response, 200, { deleted: true });
    return true;
  }

  send(response, 405, { error: "Method not allowed" });
  return true;
}
