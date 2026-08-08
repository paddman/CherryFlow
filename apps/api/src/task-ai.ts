import type { ModuleContext, ModuleDefinition, WorkflowData } from "@cherryflow/workflow-engine";
import type { UploadedFileValue } from "@cherryflow/ui-schema";
import { extractFileContent, type ExtractedFileContent } from "./file-content.js";

export type AiTaskOutput = WorkflowData & {
  result: string;
  summary: string;
  checklist: Array<Record<string, string>>;
  nextSteps: string;
  aiStatus: string;
};

interface AiTaskResponse {
  result?: unknown;
  summary?: unknown;
  checklist?: unknown;
  nextSteps?: unknown;
}

const MAX_INPUT_CHARS = 4_000;
const MAX_SOURCE_CHARS = 12_000;

function isUploadedFile(value: unknown): value is UploadedFileValue {
  return Boolean(
    value
    && typeof value === "object"
    && "name" in value
    && "size" in value
    && ("dataUrl" in value || "objectKey" in value || "url" in value),
  );
}

function dependency(dependencies: Record<string, WorkflowData>, nodeId: string): WorkflowData {
  const value = dependencies[nodeId];
  if (!value) throw new Error(`Missing dependency output: ${nodeId}`);
  return value;
}

function cleanText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function labelsFromConfig(config: WorkflowData): Record<string, string> {
  const value = config.inputLabels;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function formatInputValue(value: unknown): string {
  if (value == null || value === "") return "(ไม่ได้ระบุ)";
  if (isUploadedFile(value)) return `${value.name} · ${value.type || "unknown"} · ${value.size.toLocaleString("en-US")} bytes`;
  if (typeof value === "string") return value.slice(0, MAX_INPUT_CHARS);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value).slice(0, MAX_INPUT_CHARS);
}

function inputContext(inputs: WorkflowData, labels: Record<string, string>): string {
  return Object.entries(inputs)
    .filter(([, value]) => !isUploadedFile(value))
    .map(([key, value]) => `- ${labels[key] ?? key}: ${formatInputValue(value)}`)
    .join("\n");
}

function extractedPreview(extracted: ExtractedFileContent): string {
  if (extracted.kind === "text") {
    return extracted.text.slice(0, MAX_SOURCE_CHARS);
  }

  const lines = [
    extracted.columns.join(" | "),
    ...extracted.rows.slice(0, 80).map((row) => extracted.columns.map((column) => String(row[column] ?? "")).join(" | ")),
  ];
  return lines.join("\n").slice(0, MAX_SOURCE_CHARS);
}

async function sourceContext(inputs: WorkflowData, configuredField: string | undefined): Promise<{ label: string; content: string } | undefined> {
  const candidates = configuredField
    ? [[configuredField, inputs[configuredField]] as const]
    : Object.entries(inputs).filter((entry): entry is [string, UploadedFileValue] => isUploadedFile(entry[1]));

  const selected = candidates.find(([, value]) => isUploadedFile(value));
  if (!selected || !isUploadedFile(selected[1])) return undefined;
  const extracted = await extractFileContent(selected[1]);
  return {
    label: `${selected[0]} · ${selected[1].name}`,
    content: extractedPreview(extracted),
  };
}

function stripMarkdownFence(content: string): string {
  return content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function parseAiTaskResponse(content: string): AiTaskResponse | undefined {
  const cleaned = stripMarkdownFence(content);
  const candidates = [cleaned];
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch && objectMatch[0] !== cleaned) candidates.push(objectMatch[0]);

  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate) as unknown;
      if (value && typeof value === "object" && !Array.isArray(value)) return value as AiTaskResponse;
    } catch {
      // Some local models still return Markdown despite JSON instructions.
    }
  }
  return undefined;
}

function normalizeChecklist(value: unknown): Array<Record<string, string>> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((item, index) => {
    if (typeof item === "string") {
      return { ลำดับ: String(index + 1), รายการ: item, สถานะ: "ต้องตรวจทาน", หมายเหตุ: "" };
    }
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const record = item as Record<string, unknown>;
      return {
        ลำดับ: String(index + 1),
        รายการ: cleanText(record.item ?? record.task ?? record.title ?? record.รายการ, `รายการ ${index + 1}`),
        สถานะ: cleanText(record.status ?? record.state ?? record.สถานะ, "ต้องตรวจทาน"),
        หมายเหตุ: cleanText(record.note ?? record.detail ?? record.หมายเหตุ, ""),
      };
    }
    return { ลำดับ: String(index + 1), รายการ: String(item), สถานะ: "ต้องตรวจทาน", หมายเหตุ: "" };
  });
}

function defaultChecklist(taskName: string): Array<Record<string, string>> {
  return [
    { ลำดับ: "1", รายการ: `ตรวจสอบข้อมูลนำเข้าสำหรับ ${taskName}`, สถานะ: "พร้อมตรวจ", หมายเหตุ: "ยืนยันชื่อ วันที่ ตัวเลข และแหล่งอ้างอิง" },
    { ลำดับ: "2", รายการ: "ทบทวนผลลัพธ์โดยเจ้าของงาน", สถานะ: "รอทบทวน", หมายเหตุ: "AI เป็นผู้ช่วยร่าง ไม่ใช่ผู้อนุมัติ" },
    { ลำดับ: "3", รายการ: "อนุมัติก่อนส่งหรือเผยแพร่", สถานะ: "รออนุมัติ", หมายเหตุ: "เก็บหลักฐานและ Version ที่ใช้งาน" },
  ];
}

function deterministicOutput(taskName: string, instructions: string, inputs: WorkflowData, labels: Record<string, string>, source?: { label: string; content: string }): AiTaskOutput {
  const context = inputContext(inputs, labels) || "- ไม่มีข้อมูลข้อความ";
  const sourceNote = source
    ? `\n\n## ข้อมูลจากไฟล์\nไฟล์: ${source.label}\n\n${source.content.slice(0, 3_000)}`
    : "";
  return {
    result: [
      `# ${taskName}`,
      "",
      "ระบบทำงานในโหมด Local deterministic fallback เนื่องจากยังไม่ได้เปิด OpenAI-compatible provider สำหรับงานนี้",
      "",
      "## โจทย์และข้อมูลนำเข้า",
      context,
      sourceNote,
      "",
      "## แนวทางดำเนินงาน",
      instructions,
      "",
      "## หมายเหตุ",
      "ผลลัพธ์นี้เป็นโครงงานที่พร้อมให้ผู้ใช้ตรวจแก้ เมื่อเชื่อม Local Qwen ระบบจะสร้างฉบับวิเคราะห์และเรียบเรียงเต็มรูปแบบโดยใช้ข้อมูลชุดเดียวกัน",
    ].filter(Boolean).join("\n"),
    summary: `เตรียมโครง ${taskName} จากข้อมูลที่ได้รับแล้ว กรุณาตรวจสอบรายละเอียดสำคัญก่อนนำไปใช้จริง`,
    checklist: defaultChecklist(taskName),
    nextSteps: [
      "- ตรวจความครบถ้วนของข้อมูลนำเข้า",
      "- เชื่อม Local Qwen โดยตั้ง `CHERRYFLOW_AI_PROVIDER=openai` และ `OPENAI_BASE_URL` เพื่อสร้างฉบับสมบูรณ์",
      "- ให้เจ้าของงานตรวจแก้และอนุมัติก่อนเผยแพร่",
    ].join("\n"),
    aiStatus: "deterministic-fallback",
  };
}

function modelEnabled(env: NodeJS.ProcessEnv): boolean {
  return (env.CHERRYFLOW_AI_PROVIDER ?? "local").trim().toLowerCase() === "openai" && Boolean(env.OPENAI_BASE_URL?.trim());
}

async function callModel(taskName: string, role: string, instructions: string, inputText: string, source: { label: string; content: string } | undefined, env: NodeJS.ProcessEnv): Promise<string> {
  const baseUrl = env.OPENAI_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("OPENAI_BASE_URL is not configured");

  const system = [
    `คุณคือ ${role}`,
    "ทำงานเป็นภาษาไทยแบบมืออาชีพ อ่านง่าย และใช้ข้อมูลที่ได้รับเท่านั้น",
    "ห้ามสร้างชื่อ บุคคล ตัวเลข กฎหมาย เงื่อนไข หรือข้อเท็จจริงที่ไม่มีในข้อมูล",
    "เมื่อข้อมูลไม่พอ ให้ระบุสิ่งที่ต้องขอเพิ่มอย่างชัดเจน",
    "ตอบเป็น JSON object เท่านั้น โดยมี keys: result, summary, checklist, nextSteps",
    "result และ summary เป็น Markdown, nextSteps เป็น Markdown bullet list",
    "checklist เป็น array ของ object ที่มี item, status, note",
  ].join(" ");

  const user = [
    `ชื่องาน: ${taskName}`,
    "คำสั่งเฉพาะงาน:",
    instructions,
    "",
    "ข้อมูลจากแบบฟอร์ม:",
    inputText || "(ไม่มีข้อมูลข้อความ)",
    source ? `\nข้อมูลจากไฟล์ ${source.label}:\n${source.content}` : "",
  ].join("\n");

  const responseFormat = (env.OPENAI_RESPONSE_FORMAT ?? "json_object").trim().toLowerCase();
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.OPENAI_API_KEY ? { authorization: `Bearer ${env.OPENAI_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL ?? "qwen3.5-35b-a3b",
      max_tokens: Number(env.OPENAI_MAX_TOKENS ?? 2_000),
      temperature: 0.2,
      ...(responseFormat === "json_object" ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Model endpoint returned HTTP ${response.status}`);
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Model returned empty content");
  return content;
}

export async function runAiTask(context: ModuleContext, env: NodeJS.ProcessEnv = process.env): Promise<AiTaskOutput> {
  const inputNode = String(context.config.inputNode ?? "input");
  const inputs = dependency(context.dependencies, inputNode);
  const taskName = cleanText(context.config.taskName, "AI Task");
  const role = cleanText(context.config.role, "ผู้เชี่ยวชาญงานธุรกิจ");
  const instructions = cleanText(context.config.instructions, "วิเคราะห์ข้อมูลและจัดทำผลลัพธ์ที่นำไปใช้งานต่อได้");
  const fileField = cleanText(context.config.fileField) || undefined;
  const labels = labelsFromConfig(context.config);
  const source = await sourceContext(inputs, fileField);
  const fallback = deterministicOutput(taskName, instructions, inputs, labels, source);

  if (!modelEnabled(env)) return fallback;

  try {
    const content = await callModel(taskName, role, instructions, inputContext(inputs, labels), source, env);
    const parsed = parseAiTaskResponse(content);
    const result = cleanText(parsed?.result, parsed ? "" : content) || content;
    const summary = cleanText(parsed?.summary, result.slice(0, 500));
    const checklist = normalizeChecklist(parsed?.checklist);
    const nextSteps = cleanText(parsed?.nextSteps, "- ตรวจทานผลลัพธ์\n- อนุมัติก่อนนำไปใช้จริง");
    return {
      result,
      summary,
      checklist: checklist.length > 0 ? checklist : defaultChecklist(taskName),
      nextSteps,
      aiStatus: `openai-compatible:${env.OPENAI_MODEL ?? "qwen3.5-35b-a3b"}`,
    };
  } catch (error) {
    console.error("[ai-task] model call failed, using deterministic fallback:", error);
    return {
      ...fallback,
      aiStatus: `deterministic-fallback:${error instanceof Error ? error.message : "model request failed"}`,
    };
  }
}

export function createAiTaskModuleDefinition(): ModuleDefinition {
  return {
    type: "ai.task",
    label: "Reusable AI Task",
    description: "Run a configurable business task with Local Qwen through an OpenAI-compatible endpoint and a deterministic offline fallback.",
    run: runAiTask,
  };
}
