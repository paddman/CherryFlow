import type { IncomingMessage, ServerResponse } from "node:http";
import { deleteMemory, memoryEnabled, memoryStats, searchMemory, upsertMemory } from "./memory-store.js";
import { readJson, send } from "./http-utils.js";

interface MemoryWriteBody {
  namespace?: string;
  sourceId?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

interface MemorySearchBody {
  namespace?: string;
  query?: string;
  limit?: number;
  minScore?: number;
}

function ensureMemory(response: ServerResponse): boolean {
  if (memoryEnabled()) return true;
  send(response, 503, {
    error: "AI memory is unavailable",
    hint: "Set CHERRYFLOW_STORE=postgres and DATABASE_URL, then run PostgreSQL with pgvector.",
  });
  return false;
}

export async function handleMemoryRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (request.method === "GET" && pathname === "/api/memory/stats") {
    if (!ensureMemory(response)) return true;
    send(response, 200, { memory: await memoryStats() });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/memory/upsert") {
    if (!ensureMemory(response)) return true;
    const body = await readJson<MemoryWriteBody>(request);
    const memory = await upsertMemory({
      content: body.content ?? "",
      ...(body.namespace ? { namespace: body.namespace } : {}),
      ...(body.sourceId ? { sourceId: body.sourceId } : {}),
      ...(body.metadata ? { metadata: body.metadata } : {}),
    });
    send(response, 200, { memory });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/memory/search") {
    if (!ensureMemory(response)) return true;
    const body = await readJson<MemorySearchBody>(request);
    const results = await searchMemory({
      query: body.query ?? "",
      ...(body.namespace ? { namespace: body.namespace } : {}),
      ...(body.limit === undefined ? {} : { limit: body.limit }),
      ...(body.minScore === undefined ? {} : { minScore: body.minScore }),
    });
    send(response, 200, { results });
    return true;
  }

  const deleteMatch = /^\/api\/memory\/([^/]+)$/.exec(pathname);
  if (request.method === "DELETE" && deleteMatch) {
    if (!ensureMemory(response)) return true;
    const deleted = await deleteMemory(decodeURIComponent(deleteMatch[1] ?? ""));
    send(response, deleted ? 200 : 404, deleted ? { deleted: true } : { error: "Memory not found" });
    return true;
  }

  return false;
}
