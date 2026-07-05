import type { IncomingMessage, ServerResponse } from "node:http";
import { readJson, send } from "./http-utils.js";
import { listModels, listWorkerPools, upsertModels, upsertWorkerPool } from "./store.js";
import type { ModelRegistryEntry, WorkerPool } from "./types.js";

function openAiBaseUrl(): string | undefined {
  return process.env.OPENAI_BASE_URL?.replace(/\/$/, "");
}

function capabilitiesFor(modelId: string): string[] {
  const lower = modelId.toLowerCase();
  const capabilities = ["chat", "json"];
  if (lower.includes("coder") || lower.includes("code")) capabilities.push("code");
  if (lower.includes("embed")) capabilities.push("embedding");
  if (lower.includes("vision") || lower.includes("vl")) capabilities.push("vision");
  if (lower.includes("reason") || lower.includes("r1") || lower.includes("qwq")) capabilities.push("reasoning");
  return [...new Set(capabilities)];
}

async function fetchOpenAiModels(): Promise<string[]> {
  const base = openAiBaseUrl();
  if (!base) return [];
  const response = await fetch(`${base}/models`, {
    headers: process.env.OPENAI_API_KEY ? { authorization: `Bearer ${process.env.OPENAI_API_KEY}` } : {},
  });
  if (!response.ok) throw new Error(`Model registry endpoint returned HTTP ${response.status}`);
  const payload = await response.json() as { data?: Array<{ id?: string }> };
  return (payload.data ?? []).map((item) => item.id).filter((id): id is string => Boolean(id));
}

export async function syncModelRegistry() {
  const endpoint = openAiBaseUrl();
  const now = new Date().toISOString();
  try {
    const modelIds = await fetchOpenAiModels();
    const models: ModelRegistryEntry[] = modelIds.map((id) => ({
      id,
      provider: "openai",
      displayName: id,
      ...(endpoint ? { endpoint } : {}),
      capabilities: capabilitiesFor(id),
      status: "available",
      updatedAt: now,
    }));
    const pool: WorkerPool = {
      id: "gpu-openai-compatible",
      type: "dl",
      label: "GPU OpenAI-compatible worker pool",
      ...(endpoint ? { endpoint } : {}),
      status: modelIds.length > 0 ? "online" : "degraded",
      models: modelIds,
      concurrency: Number(process.env.ML_WORKER_CONCURRENCY ?? 1),
      updatedAt: now,
    };
    await upsertModels(models);
    await upsertWorkerPool(pool);
    return { models: await listModels(), workerPools: await listWorkerPools(), synced: true };
  } catch (error) {
    await upsertWorkerPool({
      id: "gpu-openai-compatible",
      type: "dl",
      label: "GPU OpenAI-compatible worker pool",
      ...(endpoint ? { endpoint } : {}),
      status: "offline",
      models: [],
      concurrency: Number(process.env.ML_WORKER_CONCURRENCY ?? 1),
      updatedAt: now,
    });
    throw error;
  }
}

export async function handleModelRegistryRoutes(request: IncomingMessage, response: ServerResponse, pathname: string): Promise<boolean> {
  if (request.method === "GET" && pathname === "/api/models") {
    let models = await listModels();
    let workerPools = await listWorkerPools();
    if (models.length === 0 && workerPools.length === 0) {
      try {
        const synced = await syncModelRegistry();
        models = synced.models;
        workerPools = synced.workerPools;
      } catch {
        workerPools = await listWorkerPools();
      }
    }
    send(response, 200, { models, workerPools });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/models/sync") {
    try {
      send(response, 200, await syncModelRegistry());
    } catch (error) {
      send(response, 502, { error: error instanceof Error ? error.message : "Unable to sync model registry", workerPools: await listWorkerPools() });
    }
    return true;
  }

  if (request.method === "GET" && pathname === "/api/worker-pools") {
    send(response, 200, { workerPools: await listWorkerPools() });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/worker-pools") {
    const body = await readJson<Partial<WorkerPool>>(request);
    if (!body.id || !body.label || !body.type) {
      send(response, 400, { error: "id, label, and type are required" });
      return true;
    }
    const pool: WorkerPool = {
      id: body.id,
      type: body.type,
      label: body.label,
      ...(body.endpoint ? { endpoint: body.endpoint } : {}),
      status: body.status ?? "offline",
      models: body.models ?? [],
      concurrency: body.concurrency ?? 1,
      updatedAt: new Date().toISOString(),
    };
    send(response, 201, { workerPool: await upsertWorkerPool(pool) });
    return true;
  }

  return false;
}
