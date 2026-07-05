import type { WorkflowData, WorkflowGraph } from "@cherryflow/workflow-engine";
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
  canvases: CanvasFlow[];
}

export interface WorkflowDefinition {
  contract: WorkflowContract;
  graph: WorkflowGraph;
}

export interface CanvasNode {
  id: string;
  moduleType: string;
  label: string;
  position: { x: number; y: number };
  config: WorkflowData;
}

export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
}

export interface CanvasFlow {
  workflowId: string;
  graph: WorkflowGraph;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  updatedAt: string;
}
