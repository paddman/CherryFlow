import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { UiSchema, WorkflowInputValues, WorkflowRun } from "@cherryflow/ui-schema";
import { sanitizeSlug } from "@cherryflow/ui-schema";
import type { AppVersion, PublishedApp, StoreData } from "./types.js";

const dataFile = resolve(process.env.CHERRYFLOW_DATA_FILE ?? "./data/cherryflow.json");
const emptyData: StoreData = { versions: [], publishedApps: [], runs: [] };
let writeQueue = Promise.resolve();

async function load(): Promise<StoreData> {
  try {
    return JSON.parse(await readFile(dataFile, "utf8")) as StoreData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(emptyData);
    throw error;
  }
}

async function persist(data: StoreData): Promise<void> {
  await mkdir(dirname(dataFile), { recursive: true });
  const temporaryFile = `${dataFile}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(data, null, 2), "utf8");
  await rename(temporaryFile, dataFile);
}

async function mutate<T>(operation: (data: StoreData) => T | Promise<T>): Promise<T> {
  let result!: T;
  writeQueue = writeQueue.then(async () => {
    const data = await load();
    result = await operation(data);
    await persist(data);
  });
  await writeQueue;
  return result;
}

export async function saveVersion(workflowId: string, schema: UiSchema, prompt: string, status: AppVersion["status"] = "draft"): Promise<AppVersion> {
  return mutate((data) => {
    const version: AppVersion = { id: crypto.randomUUID(), workflowId, schema, prompt, createdAt: new Date().toISOString(), status };
    data.versions.push(version);
    return version;
  });
}

export async function listVersions(workflowId: string): Promise<AppVersion[]> {
  const data = await load();
  return data.versions.filter((version) => version.workflowId === workflowId).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getVersion(versionId: string): Promise<AppVersion | undefined> {
  const data = await load();
  return data.versions.find((version) => version.id === versionId);
}

export async function publishSchema(workflowId: string, schema: UiSchema, prompt: string, requestedSlug: string): Promise<{ app: PublishedApp; version: AppVersion }> {
  return mutate((data) => {
    const version: AppVersion = { id: crypto.randomUUID(), workflowId, schema, prompt, createdAt: new Date().toISOString(), status: "published" };
    const slug = sanitizeSlug(requestedSlug);
    const app: PublishedApp = { slug, workflowId, versionId: version.id, publishedAt: new Date().toISOString() };
    data.versions.push(version);
    data.publishedApps = data.publishedApps.filter((item) => item.slug !== slug);
    data.publishedApps.push(app);
    return { app, version };
  });
}

export async function getPublishedApp(slug: string) {
  const data = await load();
  const app = data.publishedApps.find((item) => item.slug === sanitizeSlug(slug));
  if (!app) return undefined;
  const version = data.versions.find((item) => item.id === app.versionId);
  return version ? { app, version } : undefined;
}

export async function createRun(workflowId: string, inputs: WorkflowInputValues): Promise<WorkflowRun> {
  return mutate((data) => {
    const now = new Date().toISOString();
    const run: WorkflowRun = { id: crypto.randomUUID(), workflowId, status: "queued", createdAt: now, updatedAt: now, inputs };
    data.runs.push(run);
    if (data.runs.length > 500) data.runs.splice(0, data.runs.length - 500);
    return run;
  });
}

export async function updateRun(runId: string, patch: Partial<WorkflowRun>): Promise<WorkflowRun | undefined> {
  return mutate((data) => {
    const run = data.runs.find((item) => item.id === runId);
    if (!run) return undefined;
    Object.assign(run, patch, { updatedAt: new Date().toISOString() });
    return run;
  });
}

export async function getRun(runId: string): Promise<WorkflowRun | undefined> {
  const data = await load();
  return data.runs.find((run) => run.id === runId);
}
