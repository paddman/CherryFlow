import type { WorkflowData } from "@cherryflow/workflow-engine";
import type { CherryToolRegistry } from "./tool-registry.js";

interface OpenAiToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

type LoopMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls: OpenAiToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface AgentToolCallTrace {
  id: string;
  name: string;
  arguments: WorkflowData;
  status: "completed" | "failed";
  result?: WorkflowData;
  error?: string;
}

export interface AgentLoopResult {
  answer: string;
  iterations: number;
  toolCalls: AgentToolCallTrace[];
  model: string;
}

export interface AgentLoopOptions {
  prompt: string;
  registry: CherryToolRegistry;
  allowedTools?: readonly string[];
  approvedTools?: readonly string[];
  workflowInputs?: WorkflowData;
  dependencies?: Record<string, WorkflowData>;
  systemPrompt?: string;
  maxIterations?: number;
  maxToolOutputChars?: number;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

const defaultSystemPrompt = `You are Cherry, the CherryFlow execution agent. Use the supplied tools whenever they are needed to answer accurately. Never invent a tool result. After receiving tool results, continue reasoning and either call another tool or return a concise final answer. Do not claim that a write or admin action succeeded unless its tool result confirms success.`;

function boundedInteger(value: number | undefined, fallback: number, minimum: number, maximum: number, label: string): number {
  const selected = value ?? fallback;
  if (!Number.isInteger(selected) || selected < minimum || selected > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return selected;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function parseArguments(raw: string): WorkflowData {
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  const record = asRecord(parsed);
  if (!record) throw new Error("Tool arguments must decode to a JSON object");
  return record;
}

function normalizeToolCalls(value: unknown, iteration: number): OpenAiToolCall[] {
  if (!Array.isArray(value)) return [];
  return value.map((candidate, index) => {
    const call = asRecord(candidate);
    const function_ = asRecord(call?.function);
    const name = typeof function_?.name === "string" ? function_.name.trim() : "";
    if (!name) throw new Error("Model returned a tool call without a function name");

    const rawArguments = function_?.arguments;
    const arguments_ = typeof rawArguments === "string" ? rawArguments : JSON.stringify(rawArguments ?? {});
    const id = typeof call?.id === "string" && call.id.trim() ? call.id : `tool_call_${iteration}_${index + 1}`;
    return { id, type: "function", function: { name, arguments: arguments_ } };
  });
}

function serializeToolResult(payload: Record<string, unknown>, maximumCharacters: number): string {
  const serialized = JSON.stringify(payload);
  if (serialized.length <= maximumCharacters) return serialized;
  return JSON.stringify({
    ok: payload.ok,
    truncated: true,
    content: serialized.slice(0, maximumCharacters),
  });
}

function responseMessage(value: unknown): Record<string, unknown> {
  const data = asRecord(value);
  const choices = Array.isArray(data?.choices) ? data.choices : [];
  const firstChoice = asRecord(choices[0]);
  const message = asRecord(firstChoice?.message);
  if (!message) throw new Error("Model endpoint returned no assistant message");
  return message;
}

export async function runOpenAiToolLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
  const prompt = options.prompt.trim();
  if (!prompt) throw new Error("Agent prompt is required");

  const maxIterations = boundedInteger(
    options.maxIterations,
    Number(process.env.CHERRYFLOW_AGENT_MAX_ITERATIONS ?? 8),
    1,
    20,
    "maxIterations",
  );
  const maxToolOutputChars = boundedInteger(
    options.maxToolOutputChars,
    Number(process.env.CHERRYFLOW_TOOL_OUTPUT_MAX_CHARS ?? 24_000),
    1_000,
    200_000,
    "maxToolOutputChars",
  );
  const baseUrl = (options.baseUrl ?? process.env.OPENAI_BASE_URL ?? "http://localhost:8000/v1").replace(/\/$/, "");
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const model = options.model ?? process.env.OPENAI_MODEL ?? "qwen3.5-35b-a3b";
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const allowedTools = options.allowedTools ?? options.registry.list().map((tool) => tool.name);
  const allowedToolNames = new Set(allowedTools);
  const tools = options.registry.toOpenAiTools(allowedTools);
  if (tools.length === 0) throw new Error("At least one allowed tool is required");

  const approvedTools = new Set(options.approvedTools ?? []);
  const messages: LoopMessage[] = [
    { role: "system", content: options.systemPrompt?.trim() || defaultSystemPrompt },
    { role: "user", content: prompt },
  ];
  const traces: AgentToolCallTrace[] = [];

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;

    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        tools,
        tool_choice: "auto",
        stream: false,
      }),
    });
    if (!response.ok) throw new Error(`Model endpoint returned HTTP ${response.status}`);

    const message = responseMessage(await response.json());
    const toolCalls = normalizeToolCalls(message.tool_calls, iteration);
    if (toolCalls.length === 0) {
      const content = typeof message.content === "string" ? message.content.trim() : "";
      if (!content) throw new Error("Model returned neither a final answer nor tool calls");
      return { answer: content, iterations: iteration, toolCalls: traces, model };
    }

    if (iteration === maxIterations) {
      throw new Error(`Agent exceeded the maximum of ${maxIterations} model iterations`);
    }

    messages.push({
      role: "assistant",
      content: typeof message.content === "string" ? message.content : null,
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      let arguments_: WorkflowData = {};
      try {
        if (!allowedToolNames.has(toolCall.function.name)) {
          throw new Error(`Tool is not allowed for this run: ${toolCall.function.name}`);
        }
        arguments_ = parseArguments(toolCall.function.arguments);
        const result = await options.registry.execute(toolCall.function.name, arguments_, {
          workflowInputs: options.workflowInputs ?? {},
          dependencies: options.dependencies ?? {},
          approvedTools,
        });
        traces.push({
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: arguments_,
          status: "completed",
          result,
        });
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: serializeToolResult({ ok: true, result }, maxToolOutputChars),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Tool execution failed";
        traces.push({
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: arguments_,
          status: "failed",
          error: errorMessage,
        });
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: serializeToolResult({ ok: false, error: errorMessage }, maxToolOutputChars),
        });
      }
    }
  }

  throw new Error("Agent loop ended without a final answer");
}
