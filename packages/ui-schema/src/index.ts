export type WorkflowFieldType = "text" | "textarea" | "number" | "date" | "select" | "boolean" | "file";

export interface WorkflowInput {
  name: string;
  label: string;
  type: WorkflowFieldType;
  description?: string;
  placeholder?: string;
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
  description: string;
  inputs: WorkflowInput[];
  outputs: WorkflowOutput[];
}

export interface UiTheme {
  primaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  radius: "small" | "medium" | "large";
  density: "compact" | "comfortable";
}

interface ComponentBase { id: string }

export type UiComponent =
  | (ComponentBase & { type: "navbar"; brand: string; tagline?: string; items: Array<{ label: string; target: string }> })
  | (ComponentBase & { type: "hero"; badge?: string; title: string; description?: string; align?: "left" | "center" })
  | (ComponentBase & { type: "text"; title?: string; body: string })
  | (ComponentBase & { type: "notice"; tone: "info" | "success" | "warning"; title?: string; body: string })
  | (ComponentBase & { type: "stats"; title?: string; items: Array<{ value: string; label: string; detail?: string }> })
  | (ComponentBase & { type: "feature-grid"; title?: string; columns: 2 | 3; items: Array<{ title: string; description: string }> })
  | (ComponentBase & { type: "steps"; title?: string; items: Array<{ title: string; description?: string }> })
  | (ComponentBase & { type: "faq"; title?: string; items: Array<{ question: string; answer: string }> })
  | (ComponentBase & { type: "cta"; title: string; body?: string; buttonLabel: string })
  | (ComponentBase & { type: "footer"; brand: string; description?: string; copyright?: string })
  | (ComponentBase & { type: "divider" })
  | (ComponentBase & { type: "workflow-form"; title?: string; description?: string; fields: string[]; submitLabel: string })
  | (ComponentBase & { type: "job-progress"; title?: string })
  | (ComponentBase & { type: "workflow-output"; title?: string; bindings: string[]; emptyText?: string });

export interface UiSchema {
  version: "1.0";
  workflowId: string;
  meta: { name: string; description?: string };
  theme: UiTheme;
  page: {
    title: string;
    subtitle?: string;
    layout: "centered" | "dashboard" | "full-width";
    components: UiComponent[];
  };
}

export interface UploadedFileValue { name: string; type: string; size: number; dataUrl?: string; url?: string; objectKey?: string }
export type WorkflowInputValue = string | number | boolean | UploadedFileValue | null;
export type WorkflowInputValues = Record<string, WorkflowInputValue>;

export interface FileOutputValue { name: string; mimeType: string; dataUrl?: string; url?: string; objectKey?: string }
export type WorkflowOutputValue = string | number | boolean | Array<Record<string, string | number | boolean>> | FileOutputValue | null;
export type WorkflowOutputValues = Record<string, WorkflowOutputValue>;

export interface WorkflowRunStep {
  nodeId: string;
  moduleType: string;
  status: "running" | "completed" | "failed";
  at: string;
  error?: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  inputs: WorkflowInputValues;
  outputs?: WorkflowOutputValues;
  steps?: WorkflowRunStep[];
  error?: string;
}

export interface UiValidationResult { valid: boolean; errors: string[] }

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const SAFE_TARGET = /^#[a-zA-Z][a-zA-Z0-9_-]{0,79}$/;

export function createDefaultTheme(): UiTheme {
  return {
    primaryColor: "#1769e0",
    backgroundColor: "#eef5ff",
    surfaceColor: "#ffffff",
    textColor: "#12213a",
    radius: "large",
    density: "comfortable",
  };
}

export function validateUiSchema(schema: UiSchema, workflow: WorkflowContract): UiValidationResult {
  const errors: string[] = [];
  if (schema.version !== "1.0") errors.push("Unsupported UI Schema version");
  if (schema.workflowId !== workflow.id) errors.push("workflowId does not match the workflow contract");
  if (!schema.meta?.name?.trim()) errors.push("meta.name is required");
  if (!schema.page?.title?.trim()) errors.push("page.title is required");
  if ((schema.page?.components?.length ?? 0) > 30) errors.push("A page supports at most 30 components");

  for (const [key, value] of Object.entries(schema.theme ?? {})) {
    if (key.endsWith("Color") && typeof value === "string" && !HEX_COLOR.test(value)) errors.push(`Invalid theme color: ${key}`);
  }

  const inputNames = new Set(workflow.inputs.map((field) => field.name));
  const outputNames = new Set(workflow.outputs.map((field) => field.name));
  const ids = new Set<string>();
  let formCount = 0;
  let progressCount = 0;
  let outputCount = 0;
  let navbarCount = 0;
  let footerCount = 0;

  for (const component of schema.page?.components ?? []) {
    if (!component.id?.trim()) errors.push("Every component requires an id");
    if (ids.has(component.id)) errors.push(`Duplicate component id: ${component.id}`);
    ids.add(component.id);

    if (component.type === "workflow-form") {
      formCount += 1;
      for (const field of component.fields) if (!inputNames.has(field)) errors.push(`Unknown input binding: ${field}`);
    }
    if (component.type === "job-progress") progressCount += 1;
    if (component.type === "workflow-output") {
      outputCount += 1;
      for (const binding of component.bindings) if (!outputNames.has(binding)) errors.push(`Unknown output binding: ${binding}`);
    }
    if (component.type === "navbar") {
      navbarCount += 1;
      if (component.items.length > 8) errors.push("navbar supports at most 8 items");
      for (const item of component.items) if (!SAFE_TARGET.test(item.target)) errors.push(`Invalid navbar target: ${item.target}`);
    }
    if (component.type === "footer") footerCount += 1;
    if (component.type === "feature-grid" && component.items.length > 9) errors.push("feature-grid supports at most 9 items");
    if (component.type === "steps" && component.items.length > 9) errors.push("steps supports at most 9 items");
    if (component.type === "stats" && component.items.length > 8) errors.push("stats supports at most 8 items");
    if (component.type === "faq" && component.items.length > 12) errors.push("faq supports at most 12 items");
  }

  if (formCount !== 1) errors.push("A page must contain exactly one workflow-form");
  if (progressCount > 1) errors.push("A page supports at most one job-progress");
  if (outputCount !== 1) errors.push("A page must contain exactly one workflow-output");
  if (navbarCount > 1) errors.push("A page supports at most one navbar");
  if (footerCount > 1) errors.push("A page supports at most one footer");
  return { valid: errors.length === 0, errors };
}

export function sanitizeSlug(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9ก-๙]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return slug || "cherryflow-app";
}
