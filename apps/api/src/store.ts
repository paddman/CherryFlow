import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Pool } from "pg";
import type { UiSchema, WorkflowInputValues, WorkflowRun } from "@cherryflow/ui-schema";
import { sanitizeSlug } from "@cherryflow/ui-schema";
import type { AppVersion, PublishedApp, StoreData } from "./types.js";

const dataFile = resolve(process.env.CHERRYFLOW_DATA_FILE ?? "./data/cherryflow.json");
const emptyData: StoreData = { versions: [], publishedApps: [], runs: [] };
let writeQueue = Promise.resolve();
let pool: Pool | undefined;
let postgresReady: Promise<void> | undefined;

function postgresEnabled(): boolean {
  return (process.env.CHERRYFLOW_STORE ?? "").toLowerCase() === "postgres" || Boolean(process.env.DATABASE_URL);
}

function postgresPool(): Pool {
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgres://cherryflow:cherryflow@127.0.0.1:5432/cherryflow",
  });
  return pool;
}

async function loadJson(): Promise<StoreData> {
  try {
    return JSON.parse(await readFile(dataFile, "utf8")) as StoreData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(emptyData);
    throw error;
  }
}

async function persistJson(data: StoreData): Promise<void> {
  await mkdir(dirname(dataFile), { recursive: true });
  const temporaryFile = `${dataFile}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(data, null, 2), "utf8");
  await rename(temporaryFile, dataFile);
}

async function mutateJson<T>(operation: (data: StoreData) => T | Promise<T>): Promise<T> {
  let result!: T;
  writeQueue = writeQueue.then(async () => {
    const data = await loadJson();
    result = await operation(data);
    await persistJson(data);
  });
  await writeQueue;
  return result;
}

async function ensurePostgres(): Promise<void> {
  if (!postgresEnabled()) return;
  postgresReady ??= (async () => {
    const db = postgresPool();
    await db.query(`
      create table if not exists app_versions (
        id text primary key,
        workflow_id text not null,
        schema jsonb not null,
        prompt text not null default '',
        created_at timestamptz not null,
        status text not null check (status in ('draft', 'published'))
      );
      create index if not exists app_versions_workflow_created_idx on app_versions (workflow_id, created_at desc);

      create table if not exists published_apps (
        slug text primary key,
        workflow_id text not null,
        version_id text not null references app_versions(id) on delete cascade,
        published_at timestamptz not null
      );

      create table if not exists workflow_runs (
        id text primary key,
        workflow_id text not null,
        status text not null check (status in ('queued', 'running', 'completed', 'failed')),
        created_at timestamptz not null,
        updated_at timestamptz not null,
        inputs jsonb not null,
        outputs jsonb,
        steps jsonb,
        error text
      );
      create index if not exists workflow_runs_updated_idx on workflow_runs (updated_at desc);
    `);

    const count = await db.query<{ count: string }>("select count(*) from app_versions");
    if (Number(count.rows[0]?.count ?? 0) > 0) return;

    const data = await loadJson();
    for (const version of data.versions) {
      await db.query(
        `insert into app_versions (id, workflow_id, schema, prompt, created_at, status)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do nothing`,
        [version.id, version.workflowId, JSON.stringify(version.schema), version.prompt, version.createdAt, version.status],
      );
    }
    for (const app of data.publishedApps) {
      await db.query(
        `insert into published_apps (slug, workflow_id, version_id, published_at)
         values ($1, $2, $3, $4)
         on conflict (slug) do update set workflow_id = excluded.workflow_id, version_id = excluded.version_id, published_at = excluded.published_at`,
        [app.slug, app.workflowId, app.versionId, app.publishedAt],
      );
    }
    for (const run of data.runs) {
      await db.query(
        `insert into workflow_runs (id, workflow_id, status, created_at, updated_at, inputs, outputs, steps, error)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (id) do nothing`,
        [
          run.id,
          run.workflowId,
          run.status,
          run.createdAt,
          run.updatedAt,
          JSON.stringify(run.inputs),
          run.outputs ? JSON.stringify(run.outputs) : null,
          run.steps ? JSON.stringify(run.steps) : null,
          run.error ?? null,
        ],
      );
    }
  })();
  await postgresReady;
}

function mapVersion(row: Record<string, unknown>): AppVersion {
  return {
    id: String(row.id),
    workflowId: String(row.workflow_id),
    schema: row.schema as UiSchema,
    prompt: String(row.prompt ?? ""),
    createdAt: new Date(String(row.created_at)).toISOString(),
    status: row.status as AppVersion["status"],
  };
}

function mapApp(row: Record<string, unknown>): PublishedApp {
  return {
    slug: String(row.slug),
    workflowId: String(row.workflow_id),
    versionId: String(row.version_id),
    publishedAt: new Date(String(row.published_at)).toISOString(),
  };
}

function mapRun(row: Record<string, unknown>): WorkflowRun {
  const run: WorkflowRun = {
    id: String(row.id),
    workflowId: String(row.workflow_id),
    status: row.status as WorkflowRun["status"],
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    inputs: row.inputs as WorkflowInputValues,
  };
  if (row.outputs) run.outputs = row.outputs as NonNullable<WorkflowRun["outputs"]>;
  if (row.steps) run.steps = row.steps as NonNullable<WorkflowRun["steps"]>;
  if (row.error) run.error = String(row.error);
  return run;
}

export async function saveVersion(workflowId: string, schema: UiSchema, prompt: string, status: AppVersion["status"] = "draft"): Promise<AppVersion> {
  if (!postgresEnabled()) {
    return mutateJson((data) => {
      const version: AppVersion = { id: crypto.randomUUID(), workflowId, schema, prompt, createdAt: new Date().toISOString(), status };
      data.versions.push(version);
      return version;
    });
  }
  await ensurePostgres();
  const version: AppVersion = { id: crypto.randomUUID(), workflowId, schema, prompt, createdAt: new Date().toISOString(), status };
  await postgresPool().query(
    `insert into app_versions (id, workflow_id, schema, prompt, created_at, status) values ($1, $2, $3, $4, $5, $6)`,
    [version.id, version.workflowId, JSON.stringify(version.schema), version.prompt, version.createdAt, version.status],
  );
  return version;
}

export async function listVersions(workflowId: string): Promise<AppVersion[]> {
  if (!postgresEnabled()) {
    const data = await loadJson();
    return data.versions.filter((version) => version.workflowId === workflowId).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
  await ensurePostgres();
  const result = await postgresPool().query("select * from app_versions where workflow_id = $1 order by created_at desc", [workflowId]);
  return result.rows.map(mapVersion);
}

export async function getVersion(versionId: string): Promise<AppVersion | undefined> {
  if (!postgresEnabled()) {
    const data = await loadJson();
    return data.versions.find((version) => version.id === versionId);
  }
  await ensurePostgres();
  const result = await postgresPool().query("select * from app_versions where id = $1", [versionId]);
  return result.rows[0] ? mapVersion(result.rows[0]) : undefined;
}

export async function publishSchema(workflowId: string, schema: UiSchema, prompt: string, requestedSlug: string): Promise<{ app: PublishedApp; version: AppVersion }> {
  if (!postgresEnabled()) {
    return mutateJson((data) => {
      const version: AppVersion = { id: crypto.randomUUID(), workflowId, schema, prompt, createdAt: new Date().toISOString(), status: "published" };
      const slug = sanitizeSlug(requestedSlug);
      const app: PublishedApp = { slug, workflowId, versionId: version.id, publishedAt: new Date().toISOString() };
      data.versions.push(version);
      data.publishedApps = data.publishedApps.filter((item) => item.slug !== slug);
      data.publishedApps.push(app);
      return { app, version };
    });
  }
  await ensurePostgres();
  const version: AppVersion = { id: crypto.randomUUID(), workflowId, schema, prompt, createdAt: new Date().toISOString(), status: "published" };
  const slug = sanitizeSlug(requestedSlug);
  const app: PublishedApp = { slug, workflowId, versionId: version.id, publishedAt: new Date().toISOString() };
  const db = postgresPool();
  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into app_versions (id, workflow_id, schema, prompt, created_at, status) values ($1, $2, $3, $4, $5, $6)`,
      [version.id, version.workflowId, JSON.stringify(version.schema), version.prompt, version.createdAt, version.status],
    );
    await client.query(
      `insert into published_apps (slug, workflow_id, version_id, published_at)
       values ($1, $2, $3, $4)
       on conflict (slug) do update set workflow_id = excluded.workflow_id, version_id = excluded.version_id, published_at = excluded.published_at`,
      [app.slug, app.workflowId, app.versionId, app.publishedAt],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return { app, version };
}

export async function getPublishedApp(slug: string) {
  if (!postgresEnabled()) {
    const data = await loadJson();
    const app = data.publishedApps.find((item) => item.slug === sanitizeSlug(slug));
    if (!app) return undefined;
    const version = data.versions.find((item) => item.id === app.versionId);
    return version ? { app, version } : undefined;
  }
  await ensurePostgres();
  const result = await postgresPool().query(
    `select p.slug, p.workflow_id, p.version_id, p.published_at, v.schema, v.prompt, v.created_at, v.status
     from published_apps p
     join app_versions v on v.id = p.version_id
     where p.slug = $1`,
    [sanitizeSlug(slug)],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    app: mapApp(row),
    version: mapVersion({ id: row.version_id, workflow_id: row.workflow_id, schema: row.schema, prompt: row.prompt, created_at: row.created_at, status: row.status }),
  };
}

export async function createRun(workflowId: string, inputs: WorkflowInputValues): Promise<WorkflowRun> {
  if (!postgresEnabled()) {
    return mutateJson((data) => {
      const now = new Date().toISOString();
      const run: WorkflowRun = { id: crypto.randomUUID(), workflowId, status: "queued", createdAt: now, updatedAt: now, inputs };
      data.runs.push(run);
      if (data.runs.length > 500) data.runs.splice(0, data.runs.length - 500);
      return run;
    });
  }
  await ensurePostgres();
  const now = new Date().toISOString();
  const run: WorkflowRun = { id: crypto.randomUUID(), workflowId, status: "queued", createdAt: now, updatedAt: now, inputs };
  await postgresPool().query(
    `insert into workflow_runs (id, workflow_id, status, created_at, updated_at, inputs) values ($1, $2, $3, $4, $5, $6)`,
    [run.id, run.workflowId, run.status, run.createdAt, run.updatedAt, JSON.stringify(run.inputs)],
  );
  await postgresPool().query(`
    delete from workflow_runs where id in (
      select id from workflow_runs order by created_at desc offset 500
    )
  `);
  return run;
}

export async function updateRun(runId: string, patch: Partial<WorkflowRun>): Promise<WorkflowRun | undefined> {
  if (!postgresEnabled()) {
    return mutateJson((data) => {
      const run = data.runs.find((item) => item.id === runId);
      if (!run) return undefined;
      Object.assign(run, patch, { updatedAt: new Date().toISOString() });
      return run;
    });
  }
  await ensurePostgres();
  const current = await getRun(runId);
  if (!current) return undefined;
  const next: WorkflowRun = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await postgresPool().query(
    `update workflow_runs
     set status = $2, updated_at = $3, inputs = $4, outputs = $5, steps = $6, error = $7
     where id = $1`,
    [
      next.id,
      next.status,
      next.updatedAt,
      JSON.stringify(next.inputs),
      next.outputs ? JSON.stringify(next.outputs) : null,
      next.steps ? JSON.stringify(next.steps) : null,
      next.error ?? null,
    ],
  );
  return next;
}

export async function getRun(runId: string): Promise<WorkflowRun | undefined> {
  if (!postgresEnabled()) {
    const data = await loadJson();
    return data.runs.find((run) => run.id === runId);
  }
  await ensurePostgres();
  const result = await postgresPool().query("select * from workflow_runs where id = $1", [runId]);
  return result.rows[0] ? mapRun(result.rows[0]) : undefined;
}
