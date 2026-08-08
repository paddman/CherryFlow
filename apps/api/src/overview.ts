import type { WorkflowContract } from "@cherryflow/ui-schema";
import { moduleRegistry } from "./module-registry.js";
import { getRuntimeStatus, type RuntimeStatus } from "./runtime-status.js";
import {
  getCanvas,
  listAuthUsers,
  listModels,
  listVersions,
  listWorkerPools,
} from "./store.js";
import type { AppVersion, CanvasFlow, ModelRegistryEntry, WorkerPool } from "./types.js";
import { getWorkflow, listWorkflows } from "./workflows.js";

interface WorkflowOverview {
  id: string;
  name: string;
  description: string;
  inputCount: number;
  outputCount: number;
  nodeCount: number;
  edgeCount: number;
  canvasUpdatedAt?: string;
  versions: number;
  publishedVersions: number;
}

interface SafeVersion {
  id: string;
  workflowId: string;
  status: AppVersion["status"];
  createdAt: string;
}

interface SafeModel {
  id: string;
  provider: ModelRegistryEntry["provider"];
  displayName: string;
  capabilities: string[];
  status: ModelRegistryEntry["status"];
  contextWindow?: number;
  updatedAt: string;
}

interface SafeWorkerPool {
  id: string;
  type: WorkerPool["type"];
  label: string;
  status: WorkerPool["status"];
  models: string[];
  concurrency: number;
  updatedAt: string;
}

export interface OperationalOverview {
  generatedAt: string;
  service: "cherryflow-api";
  runtime: RuntimeStatus;
  totals: {
    workflows: number;
    modules: number;
    canvases: number;
    versions: number;
    publishedVersions: number;
    users: number;
    models: number;
    availableModels: number;
    workerPools: number;
    onlineWorkerPools: number;
  };
  workflows: WorkflowOverview[];
  recentVersions: SafeVersion[];
  models: SafeModel[];
  workerPools: SafeWorkerPool[];
  modules: ReturnType<typeof moduleRegistry.list>;
}

function workflowSummary(
  contract: WorkflowContract,
  versions: AppVersion[],
  canvas: CanvasFlow | undefined,
): WorkflowOverview {
  const definition = getWorkflow(contract.id);
  return {
    id: contract.id,
    name: contract.name,
    description: contract.description ?? "",
    inputCount: contract.inputs.length,
    outputCount: contract.outputs.length,
    nodeCount: definition?.graph.nodes.length ?? 0,
    edgeCount: definition?.graph.edges.length ?? 0,
    ...(canvas ? { canvasUpdatedAt: canvas.updatedAt } : {}),
    versions: versions.length,
    publishedVersions: versions.filter((version) => version.status === "published").length,
  };
}

function safeVersion(version: AppVersion): SafeVersion {
  return {
    id: version.id,
    workflowId: version.workflowId,
    status: version.status,
    createdAt: version.createdAt,
  };
}

function safeModel(model: ModelRegistryEntry): SafeModel {
  return {
    id: model.id,
    provider: model.provider,
    displayName: model.displayName,
    capabilities: model.capabilities,
    status: model.status,
    ...(model.contextWindow ? { contextWindow: model.contextWindow } : {}),
    updatedAt: model.updatedAt,
  };
}

function safeWorkerPool(pool: WorkerPool): SafeWorkerPool {
  return {
    id: pool.id,
    type: pool.type,
    label: pool.label,
    status: pool.status,
    models: pool.models,
    concurrency: pool.concurrency,
    updatedAt: pool.updatedAt,
  };
}

export async function getOperationalOverview(): Promise<OperationalOverview> {
  const workflows = listWorkflows();
  const [versionsByWorkflow, canvases, users, models, workerPools] = await Promise.all([
    Promise.all(workflows.map((workflow) => listVersions(workflow.id))),
    Promise.all(workflows.map((workflow) => getCanvas(workflow.id))),
    listAuthUsers(),
    listModels(),
    listWorkerPools(),
  ]);

  const versions = versionsByWorkflow.flat().sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const modules = moduleRegistry.list();

  return {
    generatedAt: new Date().toISOString(),
    service: "cherryflow-api",
    runtime: getRuntimeStatus(),
    totals: {
      workflows: workflows.length,
      modules: modules.length,
      canvases: canvases.filter(Boolean).length,
      versions: versions.length,
      publishedVersions: versions.filter((version) => version.status === "published").length,
      users: users.length,
      models: models.length,
      availableModels: models.filter((model) => model.status === "available").length,
      workerPools: workerPools.length,
      onlineWorkerPools: workerPools.filter((pool) => pool.status === "online").length,
    },
    workflows: workflows.map((workflow, index) => workflowSummary(workflow, versionsByWorkflow[index] ?? [], canvases[index])),
    recentVersions: versions.slice(0, 12).map(safeVersion),
    models: models.map(safeModel),
    workerPools: workerPools.map(safeWorkerPool),
    modules,
  };
}
