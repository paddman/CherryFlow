import { createDefaultTheme, validateUiSchema, type UiComponent, type UiSchema, type WorkflowContract } from "@cherryflow/ui-schema";

function repairComponents(components: UiComponent[], workflow: WorkflowContract): UiComponent[] {
  const repaired: UiComponent[] = [];
  const seenSingletons = new Set<string>();
  const ids = new Set<string>();
  let hasForm = false;
  let hasOutput = false;
  const add = (component: UiComponent): void => {
    let id = component.id || component.type;
    const base = id;
    let suffix = 2;
    while (ids.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    ids.add(id);
    repaired.push({ ...component, id } as UiComponent);
  };

  for (const component of components) {
    if (["job-progress", "navbar", "footer"].includes(component.type)) {
      if (seenSingletons.has(component.type)) continue;
      seenSingletons.add(component.type);
    }
    if (component.type === "workflow-form") {
      if (hasForm) continue;
      hasForm = true;
      add({
        ...component,
        fields: component.fields.filter((field) => workflow.inputs.some((input) => input.name === field)),
        submitLabel: component.submitLabel || "Run workflow",
      });
      continue;
    }
    if (component.type === "workflow-output") {
      if (hasOutput) continue;
      hasOutput = true;
      add({
        ...component,
        bindings: component.bindings.filter((binding) => workflow.outputs.some((output) => output.name === binding)),
      });
      continue;
    }
    add(component);
  }

  if (!hasForm) {
    add({
      id: "form",
      type: "workflow-form",
      title: "Start",
      description: "Complete the form to run this workflow.",
      fields: workflow.inputs.map((input) => input.name),
      submitLabel: "Run workflow",
    });
  }
  if (!seenSingletons.has("job-progress")) add({ id: "progress", type: "job-progress", title: "Status" });
  if (!hasOutput) {
    add({
      id: "output",
      type: "workflow-output",
      title: "Results",
      bindings: workflow.outputs.map((output) => output.name),
      emptyText: "Results will appear here.",
    });
  }

  return repaired;
}

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
    components: repairComponents(Array.isArray(schema.page?.components) ? schema.page.components.slice(0, 20) : [], workflow),
  };
  const result = validateUiSchema(schema, workflow);
  if (!result.valid) throw new Error(result.errors.join("; "));
  return schema;
}
