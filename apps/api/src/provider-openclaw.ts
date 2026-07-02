import { OpenClawBridgeClient } from "@cherryflow/openclaw-adapter";
import type { UiSchema, WorkflowContract } from "@cherryflow/ui-schema";

export async function requestOpenClawSchema(prompt: string, workflow: WorkflowContract, current?: UiSchema): Promise<unknown> {
  const client = new OpenClawBridgeClient({
    bridgeUrl: process.env.OPENCLAW_BRIDGE_URL ?? "http://localhost:18790",
    token: process.env.OPENCLAW_API_TOKEN ?? "",
  });
  const result = await client.runAgent({
    agentId: process.env.OPENCLAW_AGENT_ID ?? "cherryflow-ui-builder",
    prompt: `Return a CherryFlow UI Schema JSON for this workflow: ${JSON.stringify(workflow)}. Request: ${prompt.slice(0, 2000)}`,
    context: { workflow, currentSchema: current },
    idempotencyKey: crypto.randomUUID(),
  });
  if (result.status === "failed") throw new Error(result.error ?? "OpenClaw agent failed");
  return result.output;
}
