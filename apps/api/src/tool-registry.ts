import type { WorkflowData } from "@cherryflow/workflow-engine";

export type ToolRiskLevel = "read" | "write" | "admin";

export interface ToolExecutionContext {
  workflowInputs: WorkflowData;
  dependencies: Record<string, WorkflowData>;
  approvedTools: ReadonlySet<string>;
}

export interface CherryToolDefinition {
  name: string;
  description: string;
  inputSchema: WorkflowData;
  riskLevel: ToolRiskLevel;
  requiresApproval?: boolean;
  run: (arguments_: WorkflowData, context: ToolExecutionContext) => Promise<WorkflowData> | WorkflowData;
}

export interface CherryToolSummary {
  name: string;
  description: string;
  inputSchema: WorkflowData;
  riskLevel: ToolRiskLevel;
  requiresApproval: boolean;
}

export interface OpenAiToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: WorkflowData;
  };
}

function asWorkflowData(value: unknown): WorkflowData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Tool arguments must be a JSON object");
  }
  return value as WorkflowData;
}

export class CherryToolRegistry {
  private readonly tools = new Map<string, CherryToolDefinition>();

  register(definition: CherryToolDefinition): this {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(definition.name)) {
      throw new Error(`Invalid tool name: ${definition.name}`);
    }
    if (this.tools.has(definition.name)) {
      throw new Error(`Tool already registered: ${definition.name}`);
    }
    if (definition.inputSchema.type !== "object") {
      throw new Error(`Tool input schema must be an object: ${definition.name}`);
    }
    this.tools.set(definition.name, definition);
    return this;
  }

  get(name: string): CherryToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): CherryToolSummary[] {
    return [...this.tools.values()]
      .map((definition) => ({
        name: definition.name,
        description: definition.description,
        inputSchema: structuredClone(definition.inputSchema),
        riskLevel: definition.riskLevel,
        requiresApproval: definition.requiresApproval ?? definition.riskLevel !== "read",
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  toOpenAiTools(allowedNames?: readonly string[]): OpenAiToolDefinition[] {
    const allowed = allowedNames ? new Set(allowedNames) : undefined;
    const selected = [...this.tools.values()].filter((definition) => !allowed || allowed.has(definition.name));

    if (allowed) {
      const missing = [...allowed].filter((name) => !this.tools.has(name));
      if (missing.length > 0) throw new Error(`Unknown allowed tools: ${missing.join(", ")}`);
    }

    return selected.map((definition) => ({
      type: "function",
      function: {
        name: definition.name,
        description: definition.description,
        parameters: structuredClone(definition.inputSchema),
      },
    }));
  }

  async execute(name: string, arguments_: unknown, context: ToolExecutionContext): Promise<WorkflowData> {
    const definition = this.tools.get(name);
    if (!definition) throw new Error(`Unknown tool: ${name}`);

    const approvalRequired = definition.requiresApproval ?? definition.riskLevel !== "read";
    if (approvalRequired && !context.approvedTools.has(name)) {
      throw new Error(`Approval required for tool: ${name}`);
    }

    return await definition.run(asWorkflowData(arguments_), context);
  }
}
