import { createDefaultTheme, validateUiSchema, type UiComponent, type UiSchema, type WorkflowContract } from "@cherryflow/ui-schema";

const THEME_ALIASES: Record<string, keyof ReturnType<typeof createDefaultTheme>> = {
  primary: "primaryColor",
  background: "backgroundColor",
  text: "textColor",
  surface: "surfaceColor",
  card: "surfaceColor",
};

// Smaller local models frequently ignore the "flat object" instruction and wrap fields in
// a nested props object, or return page as a bare array instead of { components: [...] }.
// Coerce those shapes back before validation instead of silently dropping everything the
// model proposed down to the bare default skeleton.
function coerceRawSchema(value: Record<string, unknown>): Record<string, unknown> {
  const rawPage = value.page;
  const rawComponents = Array.isArray(rawPage) ? rawPage : (rawPage as { components?: unknown } | undefined)?.components;
  const components = Array.isArray(rawComponents)
    ? rawComponents.map((entry) => {
        if (!entry || typeof entry !== "object") return entry;
        const component = entry as Record<string, unknown>;
        const props = component.props && typeof component.props === "object" ? (component.props as Record<string, unknown>) : {};
        const { props: _props, ...rest } = component;
        return { ...props, ...rest, type: component.type ?? component.component };
      })
    : [];

  const page = Array.isArray(rawPage) ? {} : (rawPage as Record<string, unknown> | undefined) ?? {};

  const rawTheme = (value.theme as Record<string, unknown> | undefined) ?? {};
  const theme: Record<string, unknown> = { ...rawTheme };
  for (const [alias, canonical] of Object.entries(THEME_ALIASES)) {
    if (theme[canonical] === undefined && rawTheme[alias] !== undefined) theme[canonical] = rawTheme[alias];
  }

  return { ...value, theme, page: { ...page, components } };
}

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

  for (let component of components) {
    const normalized = normalizeComponentShape(component, workflow);
    if (!normalized) continue;
    component = normalized;
    if (["job-progress", "navbar", "footer"].includes(component.type)) {
      if (seenSingletons.has(component.type)) continue;
      seenSingletons.add(component.type);
    }
    if (component.type === "workflow-form") {
      if (hasForm) continue;
      hasForm = true;
      const fields = component.fields.filter((field) => workflow.inputs.some((input) => input.name === field));
      add({
        ...component,
        fields: fields.length ? fields : workflow.inputs.map((input) => input.name),
        submitLabel: component.submitLabel || "Run workflow",
      });
      continue;
    }
    if (component.type === "workflow-output") {
      if (hasOutput) continue;
      hasOutput = true;
      const bindings = component.bindings.filter((binding) => workflow.outputs.some((output) => output.name === binding));
      add({
        ...component,
        bindings: bindings.length ? bindings : workflow.outputs.map((output) => output.name),
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

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function arrayValue<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function normalizeComponentShape(component: UiComponent, workflow: WorkflowContract): UiComponent | undefined {
  const raw = component as unknown as Record<string, unknown>;
  const id = stringValue(raw.id, stringValue(raw.type, "component"));
  switch (component.type) {
    case "navbar":
      return {
        ...component,
        id,
        brand: stringValue(raw.brand, workflow.name),
        items: arrayValue<{ label?: unknown; target?: unknown }>(raw.items)
          .map((item, index) => ({
            label: stringValue(item.label, `Section ${index + 1}`),
            target: stringValue(item.target, "#form"),
          })),
      };
    case "feature-grid":
      return {
        ...component,
        id,
        columns: component.columns === 2 || component.columns === 3 ? component.columns : 3,
        items: arrayValue<{ title?: unknown; description?: unknown }>(raw.items)
          .map((item) => ({ title: stringValue(item.title, "Feature"), description: stringValue(item.description) })),
      };
    case "steps":
      return {
        ...component,
        id,
        items: arrayValue<{ title?: unknown; description?: unknown }>(raw.items)
          .map((item) => ({ title: stringValue(item.title, "Step"), description: stringValue(item.description) })),
      };
    case "stats":
      return {
        ...component,
        id,
        items: arrayValue<{ value?: unknown; label?: unknown; detail?: unknown }>(raw.items)
          .map((item) => ({ value: stringValue(item.value, "-"), label: stringValue(item.label, "Metric"), detail: stringValue(item.detail) })),
      };
    case "faq":
      return {
        ...component,
        id,
        items: arrayValue<{ question?: unknown; answer?: unknown }>(raw.items)
          .map((item) => ({ question: stringValue(item.question, "Question"), answer: stringValue(item.answer) })),
      };
    case "workflow-form":
      return {
        ...component,
        id,
        fields: arrayValue<string>(raw.fields).map((field) => String(field)),
        submitLabel: stringValue(raw.submitLabel, "Run workflow"),
      };
    case "workflow-output":
      return {
        ...component,
        id,
        bindings: arrayValue<string>(raw.bindings).map((binding) => String(binding)),
      };
    case "hero":
      return { ...component, id, title: stringValue(raw.title, workflow.name) };
    case "text":
      return { ...component, id, body: stringValue(raw.body) };
    case "notice":
      return { ...component, id, tone: ["info", "success", "warning"].includes(String(raw.tone)) ? component.tone : "info", body: stringValue(raw.body) };
    case "cta":
      return { ...component, id, title: stringValue(raw.title, "Start"), buttonLabel: stringValue(raw.buttonLabel, "Run workflow") };
    case "footer":
      return { ...component, id, brand: stringValue(raw.brand, workflow.name) };
    case "divider":
    case "job-progress":
      return { ...component, id };
    default:
      return undefined;
  }
}

export function normalizeSchema(rawValue: unknown, workflow: WorkflowContract, prompt: string): UiSchema {
  if (!rawValue || typeof rawValue !== "object") throw new Error("Provider output is not an object");
  const schema = coerceRawSchema(rawValue as Record<string, unknown>) as unknown as UiSchema;
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
