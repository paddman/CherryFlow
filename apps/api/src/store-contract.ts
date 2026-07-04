import type { UiSchema, WorkflowInputValues, WorkflowRun } from "@cherryflow/ui-schema";
import type { AppVersion, PublishedApp } from "./types.js";

export type StoreDriver = "json" | "postgres";

export interface StoreHealth {
  driver: StoreDriver;
  status: "ok" | "error";
  detail?: string;
}

export interface CherryFlowStore {
  readonly driver: StoreDriver;
  saveVersion(
    workflowId: string,
    schema: UiSchema,
    prompt: string,
    status?: AppVersion["status"],
  ): Promise<AppVersion>;
  listVersions(workflowId: string): Promise<AppVersion[]>;
  getVersion(versionId: string): Promise<AppVersion | undefined>;
  publishSchema(
    workflowId: string,
    schema: UiSchema,
    prompt: string,
    requestedSlug: string,
  ): Promise<{ app: PublishedApp; version: AppVersion }>;
  getPublishedApp(slug: string): Promise<{ app: PublishedApp; version: AppVersion } | undefined>;
  createRun(workflowId: string, inputs: WorkflowInputValues): Promise<WorkflowRun>;
  updateRun(runId: string, patch: Partial<WorkflowRun>): Promise<WorkflowRun | undefined>;
  getRun(runId: string): Promise<WorkflowRun | undefined>;
  health(): Promise<StoreHealth>;
}
