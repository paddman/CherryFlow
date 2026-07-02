import type { WorkflowInputValues } from "@cherryflow/ui-schema";
import { createRun, updateRun } from "./store.js";
import { getWorkflow } from "./workflows.js";

export async function startRun(workflowId: string, inputs: WorkflowInputValues) {
  const definition = getWorkflow(workflowId);
  if (!definition) throw new Error("Workflow not found");
  const run = await createRun(workflowId, inputs);

  setTimeout(async () => {
    try {
      await updateRun(run.id, { status: "running" });
      const outputs = await definition.execute(inputs);
      await updateRun(run.id, { status: "completed", outputs });
    } catch (error) {
      await updateRun(run.id, {
        status: "failed",
        error: error instanceof Error ? error.message : "Workflow execution failed",
      });
    }
  }, 50);

  return run;
}
