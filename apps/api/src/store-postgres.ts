import postgres from "postgres";
import type {
  UiSchema,
  WorkflowInputValues,
  WorkflowOutputValues,
  WorkflowRun,
  WorkflowRunStep,
} from "@cherryflow/ui-schema";
import { sanitizeSlug } from "@cherryflow/ui-schema";
import type { CherryFlowStore, StoreHealth } from "./store-contract.js";
import type { AppVersion, PublishedApp } from "./types.js";

interface VersionRow {
  id: string;
  workflow_id: string;
  schema: unknown;
  prompt: string;
  created_at: Date | string;
  status: AppVersion["status"];
}

interface PublishedAppRow {
  slug: string;
  workflow_id: string;
  version_id: string;
  published_at: Date | string;
}

interface RunRow {
  id: string;
  workflow_id: string;
  status: WorkflowRun["status"];
  created_at: Date | string;
  updated_at: Date | string;
  inputs: unknown;
  outputs: unknown | null;
  steps: unknown | null;
  error: string | null;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function jsonValue<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}

function mapVersion(row: VersionRow): AppVersion {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    schema: jsonValue<UiSchema>(row.schema),
    prompt: row.prompt,
    createdAt: iso(row.created_at),
    status: row.status,
  };
}

function mapPublishedApp(row: PublishedAppRow): PublishedApp {
  return {
    slug: row.slug,
    workflowId: row.workflow_id,
    versionId: row.version_id,
    publishedAt: iso(row.published_at),
  };
}

function mapRun(row: RunRow): WorkflowRun {
  const run: WorkflowRun = {
    id: row.id,
    workflowId: row.workflow_id,
    status: row.status,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    inputs: jsonValue<WorkflowInputValues>(row.inputs),
  };
  if (row.outputs !== null) run.outputs = jsonValue<WorkflowOutputValues>(row.outputs);
  if (row.steps !== null) run.steps = jsonValue<WorkflowRunStep[]>(row.steps);
  if (row.error !== null) run.error = row.error;
  return run;
}

function jsonParameter(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function createPostgresStore(
  connectionString = process.env.DATABASE_URL ?? "postgresql://cherryflow:cherryflow@localhost:5432/cherryflow",
): CherryFlowStore {
  const sql = postgres(connectionString, {
    max: Number(process.env.CHERRYFLOW_DATABASE_POOL_SIZE ?? 10),
    connect_timeout: Number(process.env.CHERRYFLOW_DATABASE_CONNECT_TIMEOUT_SECONDS ?? 10),
    idle_timeout: Number(process.env.CHERRYFLOW_DATABASE_IDLE_TIMEOUT_SECONDS ?? 20),
  });

  let schemaReady: Promise<void> | undefined;

  function ensureSchema(): Promise<void> {
    schemaReady ??= (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS cherryflow_app_versions (
          id uuid PRIMARY KEY,
          workflow_id text NOT NULL,
          schema jsonb NOT NULL,
          prompt text NOT NULL,
          created_at timestamptz NOT NULL,
          status text NOT NULL CHECK (status IN ('draft', 'published'))
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS cherryflow_app_versions_workflow_created_idx
        ON cherryflow_app_versions (workflow_id, created_at DESC)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS cherryflow_published_apps (
          slug text PRIMARY KEY,
          workflow_id text NOT NULL,
          version_id uuid NOT NULL REFERENCES cherryflow_app_versions(id) ON DELETE RESTRICT,
          published_at timestamptz NOT NULL
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS cherryflow_workflow_runs (
          id uuid PRIMARY KEY,
          workflow_id text NOT NULL,
          status text NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
          created_at timestamptz NOT NULL,
          updated_at timestamptz NOT NULL,
          inputs jsonb NOT NULL,
          outputs jsonb,
          steps jsonb,
          error text
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS cherryflow_workflow_runs_workflow_created_idx
        ON cherryflow_workflow_runs (workflow_id, created_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS cherryflow_workflow_runs_status_updated_idx
        ON cherryflow_workflow_runs (status, updated_at)
      `;
    })().catch((error) => {
      schemaReady = undefined;
      throw error;
    });
    return schemaReady;
  }

  return {
    driver: "postgres",

    async saveVersion(workflowId, schema, prompt, status = "draft"): Promise<AppVersion> {
      await ensureSchema();
      const version: AppVersion = {
        id: crypto.randomUUID(),
        workflowId,
        schema,
        prompt,
        createdAt: new Date().toISOString(),
        status,
      };
      await sql`
        INSERT INTO cherryflow_app_versions (id, workflow_id, schema, prompt, created_at, status)
        VALUES (
          ${version.id}::uuid,
          ${version.workflowId},
          ${jsonParameter(version.schema)}::jsonb,
          ${version.prompt},
          ${version.createdAt}::timestamptz,
          ${version.status}
        )
      `;
      return version;
    },

    async listVersions(workflowId): Promise<AppVersion[]> {
      await ensureSchema();
      const rows = await sql<VersionRow[]>`
        SELECT id, workflow_id, schema, prompt, created_at, status
        FROM cherryflow_app_versions
        WHERE workflow_id = ${workflowId}
        ORDER BY created_at DESC
      `;
      return rows.map(mapVersion);
    },

    async getVersion(versionId): Promise<AppVersion | undefined> {
      await ensureSchema();
      const rows = await sql<VersionRow[]>`
        SELECT id, workflow_id, schema, prompt, created_at, status
        FROM cherryflow_app_versions
        WHERE id = ${versionId}::uuid
        LIMIT 1
      `;
      const row = rows[0];
      return row ? mapVersion(row) : undefined;
    },

    async publishSchema(workflowId, schema, prompt, requestedSlug): Promise<{ app: PublishedApp; version: AppVersion }> {
      await ensureSchema();
      const now = new Date().toISOString();
      const version: AppVersion = {
        id: crypto.randomUUID(),
        workflowId,
        schema,
        prompt,
        createdAt: now,
        status: "published",
      };
      const app: PublishedApp = {
        slug: sanitizeSlug(requestedSlug),
        workflowId,
        versionId: version.id,
        publishedAt: now,
      };

      await sql.begin(async (transaction) => {
        await transaction`
          INSERT INTO cherryflow_app_versions (id, workflow_id, schema, prompt, created_at, status)
          VALUES (
            ${version.id}::uuid,
            ${version.workflowId},
            ${jsonParameter(version.schema)}::jsonb,
            ${version.prompt},
            ${version.createdAt}::timestamptz,
            ${version.status}
          )
        `;
        await transaction`
          INSERT INTO cherryflow_published_apps (slug, workflow_id, version_id, published_at)
          VALUES (${app.slug}, ${app.workflowId}, ${app.versionId}::uuid, ${app.publishedAt}::timestamptz)
          ON CONFLICT (slug) DO UPDATE SET
            workflow_id = EXCLUDED.workflow_id,
            version_id = EXCLUDED.version_id,
            published_at = EXCLUDED.published_at
        `;
      });

      return { app, version };
    },

    async getPublishedApp(slug): Promise<{ app: PublishedApp; version: AppVersion } | undefined> {
      await ensureSchema();
      const rows = await sql<Array<PublishedAppRow & VersionRow>>`
        SELECT
          app.slug,
          app.workflow_id,
          app.version_id,
          app.published_at,
          version.id,
          version.workflow_id AS version_workflow_id,
          version.schema,
          version.prompt,
          version.created_at,
          version.status
        FROM cherryflow_published_apps app
        JOIN cherryflow_app_versions version ON version.id = app.version_id
        WHERE app.slug = ${sanitizeSlug(slug)}
        LIMIT 1
      `;
      const row = rows[0];
      if (!row) return undefined;
      return {
        app: mapPublishedApp(row),
        version: {
          id: row.id,
          workflowId: String((row as Record<string, unknown>).version_workflow_id),
          schema: jsonValue<UiSchema>(row.schema),
          prompt: row.prompt,
          createdAt: iso(row.created_at),
          status: row.status,
        },
      };
    },

    async createRun(workflowId, inputs): Promise<WorkflowRun> {
      await ensureSchema();
      const now = new Date().toISOString();
      const run: WorkflowRun = {
        id: crypto.randomUUID(),
        workflowId,
        status: "queued",
        createdAt: now,
        updatedAt: now,
        inputs,
      };
      await sql`
        INSERT INTO cherryflow_workflow_runs (
          id, workflow_id, status, created_at, updated_at, inputs, outputs, steps, error
        ) VALUES (
          ${run.id}::uuid,
          ${run.workflowId},
          ${run.status},
          ${run.createdAt}::timestamptz,
          ${run.updatedAt}::timestamptz,
          ${jsonParameter(run.inputs)}::jsonb,
          NULL,
          NULL,
          NULL
        )
      `;
      return run;
    },

    async updateRun(runId, patch): Promise<WorkflowRun | undefined> {
      await ensureSchema();
      const currentRows = await sql<RunRow[]>`
        SELECT id, workflow_id, status, created_at, updated_at, inputs, outputs, steps, error
        FROM cherryflow_workflow_runs
        WHERE id = ${runId}::uuid
        LIMIT 1
      `;
      const currentRow = currentRows[0];
      if (!currentRow) return undefined;

      const current = mapRun(currentRow);
      const updated: WorkflowRun = {
        ...current,
        ...patch,
        id: current.id,
        workflowId: current.workflowId,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      };

      const rows = await sql<RunRow[]>`
        UPDATE cherryflow_workflow_runs
        SET
          status = ${updated.status},
          updated_at = ${updated.updatedAt}::timestamptz,
          inputs = ${jsonParameter(updated.inputs)}::jsonb,
          outputs = ${updated.outputs === undefined ? null : jsonParameter(updated.outputs)}::jsonb,
          steps = ${updated.steps === undefined ? null : jsonParameter(updated.steps)}::jsonb,
          error = ${updated.error ?? null}
        WHERE id = ${runId}::uuid
        RETURNING id, workflow_id, status, created_at, updated_at, inputs, outputs, steps, error
      `;
      const row = rows[0];
      return row ? mapRun(row) : undefined;
    },

    async getRun(runId): Promise<WorkflowRun | undefined> {
      await ensureSchema();
      const rows = await sql<RunRow[]>`
        SELECT id, workflow_id, status, created_at, updated_at, inputs, outputs, steps, error
        FROM cherryflow_workflow_runs
        WHERE id = ${runId}::uuid
        LIMIT 1
      `;
      const row = rows[0];
      return row ? mapRun(row) : undefined;
    },

    async health(): Promise<StoreHealth> {
      try {
        await ensureSchema();
        await sql`SELECT 1`;
        return { driver: "postgres", status: "ok" };
      } catch (error) {
        return {
          driver: "postgres",
          status: "error",
          detail: error instanceof Error ? error.message : "PostgreSQL health check failed",
        };
      }
    },
  };
}
