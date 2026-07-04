import { OpenClawBridgeClient } from "@cherryflow/openclaw-adapter";
import type { ModuleDefinition, WorkflowData } from "@cherryflow/workflow-engine";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function optionalString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function requiredString(value: unknown, message: string): string {
  const result = optionalString(value);
  if (!result) throw new Error(message);
  return result;
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number, label: string): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function normalizeAgentOutput(output: unknown): WorkflowData {
  if (isRecord(output)) return output;
  return { output };
}

export function createOpenClawModuleDefinition(env: NodeJS.ProcessEnv = process.env): ModuleDefinition {
  return {
    type: "agent.openclaw",
    label: "OpenClaw Agent",
    description: "Run an OpenClaw agent through the explicit CherryFlow bridge contract.",
    run: async ({ workflowInputs, dependencies, config }) => {
      const prompt = requiredString(config.prompt, "agent.openclaw requires config.prompt");
      const agentId = optionalString(config.agentId, env.OPENCLAW_AGENT_ID) ?? "cherryflow-agent";
      const bridgeUrl = optionalString(env.OPENCLAW_BRIDGE_URL) ?? "http://localhost:18790";
      const token = requiredString(env.OPENCLAW_API_TOKEN, "OPENCLAW_API_TOKEN is required for agent.openclaw");
      const timeoutMs = boundedInteger(config.timeoutMs, 60_000, 1_000, 600_000, "timeoutMs");
      const pollIntervalMs = boundedInteger(config.pollIntervalMs, 800, 100, 10_000, "pollIntervalMs");
      const idempotencyKey = optionalString(config.idempotencyKey, workflowInputs.idempotencyKey) ?? crypto.randomUUID();
      const requiresApproval = config.requiresApproval === true;
      const approvalId = optionalString(config.approvalId, workflowInputs.approvalId);

      if (requiresApproval && !approvalId) {
        throw new Error("agent.openclaw requires an approvalId when requiresApproval is true");
      }

      const client = new OpenClawBridgeClient({ bridgeUrl, token, timeoutMs, pollIntervalMs });
      const result = await client.runAgent({
        agentId,
        prompt,
        idempotencyKey,
        context: {
          ...(isRecord(config.context) ? config.context : {}),
          workflowInputs,
          dependencies,
          cherryFlow: {
            moduleType: "agent.openclaw",
            riskLevel: optionalString(config.riskLevel) ?? "read",
            requiresApproval,
            approvalId,
          },
        },
      });

      if (result.status === "failed") throw new Error(result.error ?? "OpenClaw agent failed");
      if (result.status !== "completed") throw new Error(`OpenClaw agent returned unexpected status: ${result.status}`);

      return {
        ...normalizeAgentOutput(result.output),
        agentRunId: result.runId,
        status: result.status,
      };
    },
  };
}
