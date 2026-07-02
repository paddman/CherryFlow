import type { UiSchema, WorkflowContract } from "@cherryflow/ui-schema";
import { createLocalSchema } from "./local-planner.js";
import { normalizeSchema } from "./normalize-schema.js";
import { requestOpenAiSchema } from "./provider-openai.js";
import { requestOpenClawSchema } from "./provider-openclaw.js";

const provider = (process.env.CHERRYFLOW_AI_PROVIDER ?? "local").toLowerCase();

export async function planUiSchema(prompt: string, workflow: WorkflowContract, current?: UiSchema) {
  if (!prompt.trim()) throw new Error("Prompt is required");
  try {
    if (provider === "openai") {
      return { schema: normalizeSchema(await requestOpenAiSchema(prompt, workflow), workflow, prompt), provider: "openai" };
    }
    if (provider === "openclaw") {
      return { schema: normalizeSchema(await requestOpenClawSchema(prompt, workflow, current), workflow, prompt), provider: "openclaw" };
    }
    return { schema: createLocalSchema(prompt, workflow, current), provider: "local" };
  } catch (error) {
    return {
      schema: createLocalSchema(prompt, workflow, current),
      provider: "local-fallback",
      fallbackReason: error instanceof Error ? error.message : "Provider error",
    };
  }
}
