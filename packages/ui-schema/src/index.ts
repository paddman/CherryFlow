export type WorkflowFieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "file";

export interface WorkflowInput {
  name: string;
  label: string;
  type: WorkflowFieldType;
  required?: boolean;
  accept?: string[];
  options?: Array<{ label: string; value: string }>;
}

export interface WorkflowOutput {
  name: string;
  label: string;
  type: "text" | "markdown" | "table" | "image" | "file";
}

export interface WorkflowContract {
  id: string;
  name: string;
  inputs: WorkflowInput[];
  outputs: WorkflowOutput[];
}

export type UiComponent =
  | { type: "hero"; title: string; description?: string }
  | { type: "workflow-form"; fields: string[]; submitLabel: string }
  | { type: "job-progress" }
  | { type: "workflow-output"; bindings: string[] };

export interface UiSchema {
  version: "1.0";
  workflowId: string;
  page: {
    title: string;
    layout: "centered" | "dashboard" | "full-width";
    components: UiComponent[];
  };
}

export function validateUiSchema(
  schema: UiSchema,
  workflow: WorkflowContract,
): string[] {
  const errors: string[] = [];

  if (schema.workflowId !== workflow.id) {
    errors.push("workflowId does not match the workflow contract");
  }

  const inputNames = new Set(workflow.inputs.map((field) => field.name));
  const outputNames = new Set(workflow.outputs.map((field) => field.name));

  for (const component of schema.page.components) {
    if (component.type === "workflow-form") {
      for (const field of component.fields) {
        if (!inputNames.has(field)) errors.push(`Unknown input binding: ${field}`);
      }
    }

    if (component.type === "workflow-output") {
      for (const binding of component.bindings) {
        if (!outputNames.has(binding)) errors.push(`Unknown output binding: ${binding}`);
      }
    }
  }

  return errors;
}
