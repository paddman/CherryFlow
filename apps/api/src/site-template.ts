import type { UiComponent, WorkflowContract } from "@cherryflow/ui-schema";

export function createWebsiteComponents(workflow: WorkflowContract, title: string): UiComponent[] {
  return [
    { id: "navbar", type: "navbar", brand: title, items: [{ label: "Start", target: "#form" }] },
    { id: "hero", type: "hero", title, description: workflow.description, align: "center" },
    { id: "form", type: "workflow-form", title: "Start", fields: workflow.inputs.map((input) => input.name), submitLabel: "Run" },
    { id: "progress", type: "job-progress", title: "Status" },
    { id: "output", type: "workflow-output", title: "Results", bindings: workflow.outputs.map((output) => output.name) },
    { id: "footer", type: "footer", brand: title }
  ];
}
