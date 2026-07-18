import { memoryEnabled, searchMemory, upsertMemory } from "./memory-store.js";
import { CherryToolRegistry } from "./tool-registry.js";
import { getWorkflow, listWorkflows } from "./workflows.js";

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function requiredString(value: unknown, label: string): string {
  const result = optionalString(value);
  if (!result) throw new Error(`${label} is required`);
  return result;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function createCherryToolRegistry(): CherryToolRegistry {
  return new CherryToolRegistry()
    .register({
      name: "system_current_time",
      description: "Return the current server time in ISO format and in an optional IANA time zone.",
      inputSchema: {
        type: "object",
        properties: {
          timeZone: {
            type: "string",
            description: "Optional IANA time zone such as Asia/Bangkok or UTC.",
          },
        },
        additionalProperties: false,
      },
      riskLevel: "read",
      run: (arguments_) => {
        const now = new Date();
        const timeZone = optionalString(arguments_.timeZone) ?? "UTC";
        let localTime: string;
        try {
          localTime = new Intl.DateTimeFormat("en-CA", {
            dateStyle: "full",
            timeStyle: "long",
            timeZone,
          }).format(now);
        } catch {
          throw new Error(`Invalid IANA time zone: ${timeZone}`);
        }
        return { iso: now.toISOString(), timeZone, localTime };
      },
    })
    .register({
      name: "workflow_list",
      description: "List the workflow contracts currently available in CherryFlow.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      riskLevel: "read",
      run: () => ({ workflows: listWorkflows() }),
    })
    .register({
      name: "workflow_get",
      description: "Return one CherryFlow workflow contract and its validated execution graph.",
      inputSchema: {
        type: "object",
        properties: {
          workflowId: {
            type: "string",
            description: "The workflow id returned by workflow_list.",
          },
        },
        required: ["workflowId"],
        additionalProperties: false,
      },
      riskLevel: "read",
      run: (arguments_) => {
        const workflowId = requiredString(arguments_.workflowId, "workflowId");
        const workflow = getWorkflow(workflowId);
        if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
        return { contract: workflow.contract, graph: workflow.graph };
      },
    })
    .register({
      name: "memory_search",
      description: "Search CherryFlow long-term AI memory using pgvector similarity.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Question or text to retrieve related memory for." },
          namespace: { type: "string", description: "Optional memory namespace, for example finance or operations." },
          limit: { type: "number", description: "Maximum results from 1 to 50." },
          minScore: { type: "number", description: "Minimum cosine similarity from -1 to 1." },
        },
        required: ["query"],
        additionalProperties: false,
      },
      riskLevel: "read",
      run: async (arguments_) => {
        if (!memoryEnabled()) throw new Error("AI memory requires PostgreSQL with pgvector");
        const namespace = optionalString(arguments_.namespace);
        const limit = optionalNumber(arguments_.limit);
        const minScore = optionalNumber(arguments_.minScore);
        return {
          results: await searchMemory({
            query: requiredString(arguments_.query, "query"),
            ...(namespace ? { namespace } : {}),
            ...(limit === undefined ? {} : { limit }),
            ...(minScore === undefined ? {} : { minScore }),
          }),
        };
      },
    })
    .register({
      name: "memory_remember",
      description: "Store or update durable CherryFlow AI memory. This is a write action and requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          content: { type: "string", description: "Information that should be remembered." },
          namespace: { type: "string", description: "Optional memory namespace, for example finance or operations." },
          sourceId: { type: "string", description: "Optional stable id used to update the same memory later." },
          metadata: { type: "object", description: "Optional JSON metadata." },
        },
        required: ["content"],
        additionalProperties: false,
      },
      riskLevel: "write",
      run: async (arguments_) => {
        if (!memoryEnabled()) throw new Error("AI memory requires PostgreSQL with pgvector");
        const namespace = optionalString(arguments_.namespace);
        const sourceId = optionalString(arguments_.sourceId);
        const metadata = arguments_.metadata && typeof arguments_.metadata === "object" && !Array.isArray(arguments_.metadata)
          ? arguments_.metadata
          : undefined;
        return {
          memory: await upsertMemory({
            content: requiredString(arguments_.content, "content"),
            ...(namespace ? { namespace } : {}),
            ...(sourceId ? { sourceId } : {}),
            ...(metadata ? { metadata } : {}),
          }),
        };
      },
    });
}

export const cherryToolRegistry = createCherryToolRegistry();
