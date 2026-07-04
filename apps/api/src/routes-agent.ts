import type { IncomingMessage, ServerResponse } from "node:http";
import type { WorkflowData } from "@cherryflow/workflow-engine";
import { runCherryAgent } from "./cherry-agent.js";
import { cherryToolRegistry } from "./cherry-tools.js";
import { readJson, send } from "./http-utils.js";

interface AgentRunBody {
  prompt?: string;
  allowedTools?: string[];
  approvedTools?: string[];
  maxIterations?: number;
  systemPrompt?: string;
  context?: WorkflowData;
}

export async function handleAgentRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (request.method === "GET" && pathname === "/api/agent/tools") {
    send(response, 200, { tools: cherryToolRegistry.list() });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/agent/run") {
    const body = await readJson<AgentRunBody>(request);
    const result = await runCherryAgent({
      prompt: body.prompt ?? "",
      ...(body.allowedTools ? { allowedTools: body.allowedTools } : {}),
      ...(body.approvedTools ? { approvedTools: body.approvedTools } : {}),
      ...(body.maxIterations === undefined ? {} : { maxIterations: body.maxIterations }),
      ...(body.systemPrompt ? { systemPrompt: body.systemPrompt } : {}),
      ...(body.context ? { context: body.context } : {}),
    });
    send(response, 200, { agent: result });
    return true;
  }

  return false;
}
