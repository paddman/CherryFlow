import type { WorkflowGraph } from "@cherryflow/workflow-engine";
import type { UiSchema, WorkflowContract, WorkflowRun } from "@cherryflow/ui-schema";

export interface AppVersion {
  id: string;
  workflowId: string;
  schema: UiSchema;
  prompt: string;
  createdAt: string;
  status: "draft" | "published";
}

export interface PublishedApp {
  slug: string;
  workflowId: string;
  versionId: string;
  publishedAt: string;
}

export interface StoreData {
  versions: AppVersion[];
  publishedApps: PublishedApp[];
  runs: WorkflowRun[];
}

export interface WorkflowDefinition {
  contract: WorkflowContract;
  graph: WorkflowGraph;
}
