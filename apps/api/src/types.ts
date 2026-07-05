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
  authUsers: AuthUser[];
  authSessions: AuthSession[];
  models: ModelRegistryEntry[];
  workerPools: WorkerPool[];
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

export type AuthRole = "admin" | "editor" | "viewer";

export interface AuthUser {
  id: string;
  username: string;
  passwordHash: string;
  role: AuthRole;
  createdAt: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}

export interface ModelRegistryEntry {
  id: string;
  provider: "openai" | "local" | "openclaw" | "custom";
  displayName: string;
  endpoint?: string;
  capabilities: string[];
  status: "available" | "unavailable";
  contextWindow?: number;
  updatedAt: string;
}

export interface WorkerPool {
  id: string;
  type: "ml" | "dl" | "agent" | "custom";
  label: string;
  endpoint?: string;
  status: "online" | "degraded" | "offline";
  models: string[];
  concurrency: number;
  updatedAt: string;
}
