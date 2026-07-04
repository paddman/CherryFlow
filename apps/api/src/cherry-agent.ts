import type { ModuleDefinition, WorkflowData } from "@cherryflow/workflow-engine";
import { runOpenAiToolLoop, type AgentLoopResult } from "./agent-loop.js";
import { cherryToolRegistry } from "./cherry-tools.js";
import type { CherryToolRegistry } from "./tool-registry.js";

export interface CherryAgentRequest {
  prompt: string;
  allowedTools?: string[];
  approvedTools?: string[];
  maxIterations?: number;
  systemPrompt?: string;
  context?: WorkflowData;
  dependencies?: Record<string, WorkflowData>;
}

export interface CherryAgentRuntimeOptions {
  registry?: CherryToolRegistry;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown, label: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
  return [...new Set(value.map((entry) => String(entry).trim()))];
}

function optionalInteger(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${label} must be an integer`);
  return parsed;
}

function asWorkflowData(value: unknown): WorkflowData | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as WorkflowData) : undefined;
}

export async function runCherryAgent(
  request: CherryAgentRequest,
  runtime: CherryAgentRuntimeOptions = {},
): Promise<AgentLoopResult> {
  const registry = runtime.registry ?? cherryToolRegistry;
  const env = runtime.env ?? process.env;
  const allowedTools = request.allowedTools ?? registry.list().filter((tool) => tool.riskLevel === "read").map((tool) => tool.name);

  return await runOpenAiToolLoop({
    prompt: request.prompt,
    registry,
    allowedTools,
    approvedTools: request.approvedTools ?? [],
    workflowInputs: request.context ?? {},
    dependencies: request.dependencies ?? {},
    ...(request.maxIterations === undefined ? {} : { maxIterations: request.maxIterations }),
    ...(request.systemPrompt ? { systemPrompt: request.systemPrompt } : {}),
    ...(env.OPENAI_BASE_URL ? { baseUrl: env.OPENAI_BASE_URL } : {}),
    ...(env.OPENAI_API_KEY ? { apiKey: env.OPENAI_API_KEY } : {}),
    ...(env.OPENAI_MODEL ? { model: env.OPENAI_MODEL } : {}),
    ...(runtime.fetchImpl ? { fetchImpl: runtime.fetchImpl } : {}),
  });
}

export function createCherryAgentModuleDefinition(
  registry: CherryToolRegistry = cherryToolRegistry,
  env: NodeJS.ProcessEnv = process.env,
): ModuleDefinition {
  return {
    type: "agent.tool-loop",
    label: "Cherry Native Tool Agent",
    description: "Run Cherry's native OpenAI-compatible tool-calling loop with validation, approval gates, and trace output.",
    run: async ({ workflowInputs, dependencies, config }) => {
      const prompt = optionalString(config.prompt) ?? optionalString(workflowInputs.prompt) ?? optionalString(workflowInputs.message);
      if (!prompt) throw new Error("agent.tool-loop requires config.prompt or workflow input prompt/message");

      const allowedTools = stringArray(config.allowedTools, "allowedTools");
      const approvedTools = stringArray(config.approvedTools, "approvedTools");
      const maxIterations = optionalInteger(config.maxIterations, "maxIterations");
      const systemPrompt = optionalString(config.systemPrompt);
      const extraContext = asWorkflowData(config.context) ?? {};

      const result = await runCherryAgent(
        {
          prompt,
          ...(allowedTools ? { allowedTools } : {}),
          ...(approvedTools ? { approvedTools } : {}),
          ...(maxIterations === undefined ? {} : { maxIterations }),
          ...(systemPrompt ? { systemPrompt } : {}),
          context: { ...workflowInputs, ...extraContext },
          dependencies,
        },
        { registry, env },
      );

      return {
        answer: result.answer,
        iterations: result.iterations,
        toolCalls: result.toolCalls,
        model: result.model,
        runtime: "native-tool-loop",
      };
    },
  };
}
