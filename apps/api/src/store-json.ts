import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { UiSchema, WorkflowInputValues, WorkflowRun } from "@cherryflow/ui-schema";
import { sanitizeSlug } from "@cherryflow/ui-schema";
import type { CherryFlowStore, StoreHealth } from "./store-contract.js";
import type { AppVersion, PublishedApp, StoreData } from "./types.js";

const emptyData: StoreData = { versions: [], publishedApps: [], runs: [] };

export function createJsonStore(filePath = process.env.CHERRYFLOW_DATA_FILE ?? "./data/cherryflow.json"): CherryFlowStore {
  const dataFile = resolve(filePath);
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

  return {
    driver: "json",

    async saveVersion(workflowId, schema, prompt, status = "draft"): Promise<AppVersion> {
      return await mutate((data) => {
        const version: AppVersion = {
          id: crypto.randomUUID(),
          workflowId,
          schema,
          prompt,
          createdAt: new Date().toISOString(),
          status,
        };
        data.versions.push(version);
        return version;
      });
    },

    async listVersions(workflowId): Promise<AppVersion[]> {
      const data = await load();
      return data.versions
        .filter((version) => version.workflowId === workflowId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },

    async getVersion(versionId): Promise<AppVersion | undefined> {
      const data = await load();
      return data.versions.find((version) => version.id === versionId);
    },

    async publishSchema(workflowId, schema, prompt, requestedSlug): Promise<{ app: PublishedApp; version: AppVersion }> {
      return await mutate((data) => {
        const now = new Date().toISOString();
        const version: AppVersion = {
          id: crypto.randomUUID(),
          workflowId,
          schema,
          prompt,
          createdAt: now,
          status: "published",
        };
        const slug = sanitizeSlug(requestedSlug);
        const app: PublishedApp = {
          slug,
          workflowId,
          versionId: version.id,
          publishedAt: now,
        };
        data.versions.push(version);
        data.publishedApps = data.publishedApps.filter((item) => item.slug !== slug);
        data.publishedApps.push(app);
        return { app, version };
      });
    },

    async getPublishedApp(slug): Promise<{ app: PublishedApp; version: AppVersion } | undefined> {
      const data = await load();
      const app = data.publishedApps.find((item) => item.slug === sanitizeSlug(slug));
      if (!app) return undefined;
      const version = data.versions.find((item) => item.id === app.versionId);
      return version ? { app, version } : undefined;
    },

    async createRun(workflowId, inputs): Promise<WorkflowRun> {
      return await mutate((data) => {
        const now = new Date().toISOString();
        const run: WorkflowRun = {
          id: crypto.randomUUID(),
          workflowId,
          status: "queued",
          createdAt: now,
          updatedAt: now,
          inputs,
        };
        data.runs.push(run);
        if (data.runs.length > 500) data.runs.splice(0, data.runs.length - 500);
        return run;
      });
    },

    async updateRun(runId, patch): Promise<WorkflowRun | undefined> {
      return await mutate((data) => {
        const run = data.runs.find((item) => item.id === runId);
        if (!run) return undefined;
        Object.assign(run, patch, { updatedAt: new Date().toISOString() });
        return run;
      });
    },

    async getRun(runId): Promise<WorkflowRun | undefined> {
      const data = await load();
      return data.runs.find((run) => run.id === runId);
    },

    async health(): Promise<StoreHealth> {
      try {
        await load();
        return { driver: "json", status: "ok", detail: dataFile };
      } catch (error) {
        return {
          driver: "json",
          status: "error",
          detail: error instanceof Error ? error.message : "JSON store health check failed",
        };
      }
    },
  };
}
