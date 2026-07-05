import type { WorkflowContract } from "@cherryflow/ui-schema";

const schemaExample = `{"version":"1.0","workflowId":"<workflow id>","meta":{"name":"...","description":"..."},"theme":{"primaryColor":"#1769e0","backgroundColor":"#eef5ff","surfaceColor":"#ffffff","textColor":"#12213a","radius":"large","density":"comfortable"},"page":{"title":"...","subtitle":"...","layout":"centered","components":[{"id":"hero","type":"hero","title":"...","description":"..."},{"id":"form","type":"workflow-form","title":"...","fields":["<input name>"],"submitLabel":"..."},{"id":"progress","type":"job-progress","title":"..."},{"id":"output","type":"workflow-output","title":"...","bindings":["<output name>"],"emptyText":"..."}]}}`;

const schemaRules = `Return one JSON object only, matching this exact shape (fill in real content, keep every key name identical):
${schemaExample}
Allowed component types: navbar, hero, text, notice, stats, feature-grid, steps, faq, cta, footer, divider, workflow-form, job-progress, workflow-output. Every component is a FLAT object with its fields directly on it (id, type, and then that type's own fields) — never wrap fields in a nested "props" object, and never make "page" a bare array; "page" must be an object containing a "components" array. Use exactly one workflow-form and one workflow-output. Use at most one job-progress, navbar, and footer. Bind form fields and outputs only to names declared in the workflow contract. Navbar targets must be local anchors beginning with #. Do not return HTML, JavaScript, scripts, or remote resources.`;

function openAiResponseFormat(): { type: string } | undefined {
  const type = process.env.OPENAI_RESPONSE_FORMAT ?? "json_object";
  if (type === "none" || type === "") return undefined;
  return { type };
}

export function parseOpenAiJson(content: string): unknown {
  const unfenced = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(unfenced);
  } catch (error) {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(unfenced.slice(start, end + 1));
    throw error;
  }
}

export async function requestOpenAiSchema(prompt: string, workflow: WorkflowContract): Promise<unknown> {
  const base = (process.env.OPENAI_BASE_URL ?? "http://localhost:8000/v1").replace(/\/$/, "");
  const responseFormat = openAiResponseFormat();
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.OPENAI_API_KEY ? { authorization: `Bearer ${process.env.OPENAI_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "qwen3.5-35b-a3b",
      ...(responseFormat ? { response_format: responseFormat } : {}),
      ...(process.env.OPENAI_REASONING_EFFORT
        ? { reasoning_effort: process.env.OPENAI_REASONING_EFFORT }
        : {}),
      ...(process.env.OPENAI_MAX_TOKENS
        ? { max_tokens: Number(process.env.OPENAI_MAX_TOKENS) }
        : {}),
      messages: [
        { role: "system", content: `${schemaRules}\nWorkflow contract: ${JSON.stringify(workflow)}` },
        { role: "user", content: prompt.slice(0, 2000) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Model endpoint returned HTTP ${response.status}`);
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return parseOpenAiJson(data.choices?.[0]?.message?.content ?? "{}");
}
