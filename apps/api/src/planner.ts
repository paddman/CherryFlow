import type { UiSchema, WorkflowContract } from "@cherryflow/ui-schema";
import { createLocalSchema } from "./local-planner.js";
import { normalizeSchema } from "./normalize-schema.js";
import { requestOpenAiSchema } from "./provider-openai.js";
import { requestOpenClawSchema } from "./provider-openclaw.js";

const provider = (process.env.CHERRYFLOW_AI_PROVIDER ?? "local").toLowerCase();
const RETRYABLE_ATTEMPTS = 2;

async function requestRemoteSchema(prompt: string, workflow: WorkflowContract, current: UiSchema | undefined): Promise<{ schema: UiSchema; provider: string }> {
  if (provider === "openai") {
    return { schema: normalizeSchema(await requestOpenAiSchema(prompt, workflow), workflow, prompt), provider: "openai" };
  }
  return { schema: normalizeSchema(await requestOpenClawSchema(prompt, workflow, current), workflow, prompt), provider: "openclaw" };
}

export async function planUiSchema(prompt: string, workflow: WorkflowContract, current?: UiSchema) {
  if (!prompt.trim()) throw new Error("Prompt is required");
  if (provider !== "openai" && provider !== "openclaw") {
    return { schema: createLocalSchema(prompt, workflow, current), provider: "local" };
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRYABLE_ATTEMPTS; attempt += 1) {
    try {
      return await requestRemoteSchema(prompt, workflow, current);
    } catch (error) {
      lastError = error;
      console.error(`[planner] ${provider} UI generation attempt ${attempt}/${RETRYABLE_ATTEMPTS} failed:`, error);
    }
  }

  return {
    schema: createLocalSchema(prompt, workflow, current),
    provider: "local-fallback",
    fallbackReason: lastError instanceof Error ? lastError.message : "Provider error",
  };
}
