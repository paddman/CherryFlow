import { executeWorkflowGraph } from "@cherryflow/workflow-engine";
import type { WorkflowInputValues, WorkflowOutputValues } from "@cherryflow/ui-schema";
import { moduleRegistry } from "./module-registry.js";
import { createRun, updateRun } from "./store.js";
import { getWorkflow } from "./workflows.js";

export async function startRun(workflowId: string, inputs: WorkflowInputValues) {
  const definition = getWorkflow(workflowId);
  if (!definition) throw new Error("Workflow not found");
  const run = await createRun(workflowId, inputs);

  setTimeout(async () => {
    try {
      await updateRun(run.id, { status: "running" });
      const result = await executeWorkflowGraph(definition.graph, moduleRegistry, inputs);
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
  }, 50);

  return run;
}
