import type { UiSchema, WorkflowInputValues, WorkflowRun } from "@cherryflow/ui-schema";
import { createJsonStore } from "./store-json.js";
import { createPostgresStore } from "./store-postgres.js";
import type { CherryFlowStore, StoreDriver, StoreHealth } from "./store-contract.js";
import type { AppVersion, PublishedApp } from "./types.js";

function selectedDriver(value = process.env.CHERRYFLOW_STORE_DRIVER): StoreDriver {
  const normalized = (value ?? "json").trim().toLowerCase();
  if (normalized === "json" || normalized === "postgres") return normalized;
  throw new Error(`Unsupported CHERRYFLOW_STORE_DRIVER: ${value}`);
}

function createStore(): CherryFlowStore {
  const driver = selectedDriver();
  return driver === "postgres" ? createPostgresStore() : createJsonStore();
}

const store = createStore();

export function getStoreDriver(): StoreDriver {
  return store.driver;
}

export async function getStoreHealth(): Promise<StoreHealth> {
  return await store.health();
}

export async function saveVersion(
  workflowId: string,
  schema: UiSchema,
  prompt: string,
  status: AppVersion["status"] = "draft",
): Promise<AppVersion> {
  return await store.saveVersion(workflowId, schema, prompt, status);
}

export async function listVersions(workflowId: string): Promise<AppVersion[]> {
  return await store.listVersions(workflowId);
}

export async function getVersion(versionId: string): Promise<AppVersion | undefined> {
  return await store.getVersion(versionId);
}

export async function publishSchema(
  workflowId: string,
  schema: UiSchema,
  prompt: string,
  requestedSlug: string,
): Promise<{ app: PublishedApp; version: AppVersion }> {
  return await store.publishSchema(workflowId, schema, prompt, requestedSlug);
}

export async function getPublishedApp(slug: string): Promise<{ app: PublishedApp; version: AppVersion } | undefined> {
  return await store.getPublishedApp(slug);
}

export async function createRun(workflowId: string, inputs: WorkflowInputValues): Promise<WorkflowRun> {
  return await store.createRun(workflowId, inputs);
}

export async function updateRun(runId: string, patch: Partial<WorkflowRun>): Promise<WorkflowRun | undefined> {
  return await store.updateRun(runId, patch);
}

export async function getRun(runId: string): Promise<WorkflowRun | undefined> {
  return await store.getRun(runId);
}
