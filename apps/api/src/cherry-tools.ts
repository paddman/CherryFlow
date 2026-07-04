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
    });
}

export const cherryToolRegistry = createCherryToolRegistry();
