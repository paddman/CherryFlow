export type WorkflowData = Record<string, unknown>;

export interface WorkflowNode {
  id: string;
  moduleType: string;
  config?: WorkflowData;
}

export interface WorkflowEdge {
  from: string;
  to: string;
}

export interface WorkflowGraph {
  version: "1.0";
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  outputNodeId: string;
}

export interface ModuleContext {
  workflowInputs: WorkflowData;
  config: WorkflowData;
  dependencies: Record<string, WorkflowData>;
}

export interface ModuleDefinition {
  type: string;
  label: string;
  description: string;
  run: (context: ModuleContext) => Promise<WorkflowData> | WorkflowData;
}

export interface WorkflowGraphValidation {
  valid: boolean;
  errors: string[];
  order: string[];
}

export interface WorkflowNodeEvent {
  nodeId: string;
  moduleType: string;
  status: "running" | "completed" | "failed";
  at: string;
  error?: string;
}

export interface WorkflowExecutionResult {
  output: WorkflowData;
  nodeOutputs: Record<string, WorkflowData>;
  events: WorkflowNodeEvent[];
}

export class ModuleRegistry {
  private readonly modules = new Map<string, ModuleDefinition>();

  register(definition: ModuleDefinition): this {
    if (!definition.type.trim()) throw new Error("Module type is required");
    if (this.modules.has(definition.type)) throw new Error(`Module already registered: ${definition.type}`);
    this.modules.set(definition.type, definition);
    return this;
  }

  get(type: string): ModuleDefinition | undefined {
    return this.modules.get(type);
  }

  list(): Array<Omit<ModuleDefinition, "run">> {
    return [...this.modules.values()]
      .map(({ run: _run, ...definition }) => definition)
      .sort((left, right) => left.type.localeCompare(right.type));
  }
}

export function validateWorkflowGraph(graph: WorkflowGraph, registry: ModuleRegistry): WorkflowGraphValidation {
  const errors: string[] = [];
  const ids = new Set<string>();

  if (graph.version !== "1.0") errors.push("Unsupported workflow graph version");
  if (graph.nodes.length === 0) errors.push("Workflow graph requires at least one node");

  for (const node of graph.nodes) {
    if (!node.id.trim()) errors.push("Every workflow node requires an id");
    if (ids.has(node.id)) errors.push(`Duplicate workflow node id: ${node.id}`);
    ids.add(node.id);
    if (!registry.get(node.moduleType)) errors.push(`Unknown module type: ${node.moduleType}`);
  }

  if (!ids.has(graph.outputNodeId)) errors.push(`Output node not found: ${graph.outputNodeId}`);

  const incoming = new Map<string, number>(graph.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, string[]>(graph.nodes.map((node) => [node.id, []]));
  const edgeKeys = new Set<string>();

  for (const edge of graph.edges) {
    if (!ids.has(edge.from)) errors.push(`Edge source not found: ${edge.from}`);
    if (!ids.has(edge.to)) errors.push(`Edge target not found: ${edge.to}`);
    if (edge.from === edge.to) errors.push(`Self-referencing edge is not allowed: ${edge.from}`);

    const key = `${edge.from}->${edge.to}`;
    if (edgeKeys.has(key)) errors.push(`Duplicate edge: ${key}`);
    edgeKeys.add(key);

    if (ids.has(edge.from) && ids.has(edge.to) && edge.from !== edge.to) {
      outgoing.get(edge.from)?.push(edge.to);
      incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    }
  }

  const queue = graph.nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0).map((node) => node.id);
  const order: string[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) break;
    order.push(nodeId);
    for (const target of outgoing.get(nodeId) ?? []) {
      const next = (incoming.get(target) ?? 0) - 1;
      incoming.set(target, next);
      if (next === 0) queue.push(target);
    }
  }

  if (order.length !== graph.nodes.length) errors.push("Workflow graph must be acyclic");
  return { valid: errors.length === 0, errors, order };
}

export async function executeWorkflowGraph(
  graph: WorkflowGraph,
  registry: ModuleRegistry,
  workflowInputs: WorkflowData,
  onEvent?: (event: WorkflowNodeEvent) => void | Promise<void>,
): Promise<WorkflowExecutionResult> {
  const validation = validateWorkflowGraph(graph, registry);
  if (!validation.valid) throw new Error(validation.errors.join("; "));

  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const nodeOutputs: Record<string, WorkflowData> = {};
  const events: WorkflowNodeEvent[] = [];

  const emit = async (event: WorkflowNodeEvent) => {
    events.push(event);
    await onEvent?.(event);
  };

  for (const nodeId of validation.order) {
    const node = nodes.get(nodeId);
    if (!node) throw new Error(`Workflow node disappeared during execution: ${nodeId}`);
    const module = registry.get(node.moduleType);
    if (!module) throw new Error(`Module disappeared during execution: ${node.moduleType}`);

    await emit({ nodeId, moduleType: node.moduleType, status: "running", at: new Date().toISOString() });
    try {
      const dependencies = Object.fromEntries(
        graph.edges
          .filter((edge) => edge.to === nodeId)
          .map((edge) => [edge.from, nodeOutputs[edge.from] ?? {}]),
      );
      nodeOutputs[nodeId] = await module.run({
        workflowInputs,
        config: structuredClone(node.config ?? {}),
        dependencies,
      });
      await emit({ nodeId, moduleType: node.moduleType, status: "completed", at: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Workflow module failed";
      await emit({ nodeId, moduleType: node.moduleType, status: "failed", at: new Date().toISOString(), error: message });
      throw new Error(`${node.id} (${node.moduleType}): ${message}`);
    }
  }

  return { output: nodeOutputs[graph.outputNodeId] ?? {}, nodeOutputs, events };
}
