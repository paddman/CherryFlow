import { createDefaultTheme, validateUiSchema, type UiSchema, type WorkflowContract } from "@cherryflow/ui-schema";

export function normalizeSchema(value: unknown, workflow: WorkflowContract, prompt: string): UiSchema {
  if (!value || typeof value !== "object") throw new Error("Provider output is not an object");
  const schema = value as UiSchema;
  schema.version = "1.0";
  schema.workflowId = workflow.id;
  schema.theme = { ...createDefaultTheme(), ...(schema.theme ?? {}) };
  schema.meta = {
    name: String(schema.meta?.name ?? `${workflow.name} App`).slice(0, 120),
    description: String(schema.meta?.description ?? prompt).slice(0, 300),
  };
  schema.page = {
    title: String(schema.page?.title ?? workflow.name).slice(0, 120),
    subtitle: String(schema.page?.subtitle ?? workflow.description).slice(0, 300),
    layout: ["centered", "dashboard", "full-width"].includes(schema.page?.layout) ? schema.page.layout : "centered",
    components: Array.isArray(schema.page?.components) ? schema.page.components.slice(0, 20) : [],
  };
  const result = validateUiSchema(schema, workflow);
  if (!result.valid) throw new Error(result.errors.join("; "));
  return schema;
}
