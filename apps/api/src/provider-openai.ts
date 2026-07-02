import type { WorkflowContract } from "@cherryflow/ui-schema";

export async function requestOpenAiSchema(prompt: string, workflow: WorkflowContract): Promise<unknown> {
  const base = (process.env.OPENAI_BASE_URL ?? "http://localhost:8000/v1").replace(/\/$/, "");
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "qwen3.5-35b-a3b",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `Return UI Schema JSON for ${JSON.stringify(workflow)}` },
        { role: "user", content: prompt.slice(0, 2000) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Model endpoint returned HTTP ${response.status}`);
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}
