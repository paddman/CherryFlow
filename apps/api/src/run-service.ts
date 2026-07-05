import { executeWorkflowGraph } from "@cherryflow/workflow-engine";
import type { WorkflowInputValues, WorkflowOutputValues } from "@cherryflow/ui-schema";
import { storeWorkflowInputs } from "./file-storage.js";
import { moduleRegistry } from "./module-registry.js";
import { enqueueRun, redisQueueEnabled, startRunWorker as startRedisRunWorker } from "./redis-queue.js";
import { createRun, getRun, updateRun } from "./store.js";
import { getWorkflow } from "./workflows.js";

export async function startRun(workflowId: string, inputs: WorkflowInputValues) {
  const definition = getWorkflow(workflowId);
  if (!definition) throw new Error("Workflow not found");
  const run = await createRun(workflowId, inputs);
  const storedInputs = await storeWorkflowInputs(workflowId, run.id, inputs);
  const storedRun = storedInputs === inputs ? run : await updateRun(run.id, { inputs: storedInputs }) ?? run;

  if (redisQueueEnabled()) await enqueueRun(run.id);
  else setTimeout(() => void executeRun(run.id), 50);

  return storedRun;
}

export async function executeRun(runId: string): Promise<void> {
  const run = await getRun(runId);
  if (!run) throw new Error(`Run not found: ${runId}`);
  const definition = getWorkflow(run.workflowId);
  if (!definition) throw new Error("Workflow not found");
  try {
    await updateRun(run.id, { status: "running" });
    const result = await executeWorkflowGraph(definition.graph, moduleRegistry, run.inputs, async (event) => {
      const current = await getRun(run.id);
      await updateRun(run.id, { steps: [...(current?.steps ?? []), event] });
    });
    await updateRun(run.id, {
      status: "completed",
      outputs: result.output as WorkflowOutputValues,
      steps: result.events,
    });
  } catch (error) {
    await updateRun(run.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "Workflow execution failed",
    });
  }
}

export function startRunWorker(): void {
  startRedisRunWorker(executeRun);
}
