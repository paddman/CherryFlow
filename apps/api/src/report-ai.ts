import type { ExtractedFileContent } from "./file-content.js";

export type ReportMetric = { metric: string; value: string | number };

const MAX_NUMERIC_COLUMNS = 5;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isDateLikeColumn(column: string): boolean {
  return /(^|[_\s-])(date|month|year|วันที่|เดือน|ปี)($|[_\s-])/i.test(column);
}

export function computeMetrics(extracted: ExtractedFileContent, meta: { fileName: string }): ReportMetric[] {
  if (extracted.kind === "rows") {
    const metrics: ReportMetric[] = [
      { metric: "ไฟล์ต้นทาง", value: meta.fileName },
      { metric: "จำนวนแถวข้อมูล", value: extracted.rows.length },
      { metric: "จำนวนคอลัมน์", value: extracted.columns.length },
      { metric: "รายชื่อคอลัมน์", value: extracted.columns.join(", ") || "-" },
    ];
    for (const column of extracted.columns.filter((column) => !isDateLikeColumn(column)).slice(0, MAX_NUMERIC_COLUMNS)) {
      const values = extracted.rows.map((row) => row[column]).filter(isFiniteNumber);
      if (values.length === 0) continue;
      const sum = values.reduce((total, value) => total + value, 0);
      metrics.push({ metric: `${column} (ผลรวม)`, value: Number(sum.toFixed(2)) });
      metrics.push({ metric: `${column} (ค่าเฉลี่ย)`, value: Number((sum / values.length).toFixed(2)) });
    }
    if (extracted.truncated) metrics.push({ metric: "หมายเหตุ", value: `แสดงผลเฉพาะ ${extracted.rows.length} แถวแรก` });
    return metrics;
  }

  const words = extracted.text.split(/\s+/).filter(Boolean);
  const lines = extracted.text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const metrics: ReportMetric[] = [
    { metric: "ไฟล์ต้นทาง", value: meta.fileName },
    { metric: "จำนวนตัวอักษร", value: extracted.text.length },
    { metric: "จำนวนคำโดยประมาณ", value: words.length },
    { metric: "จำนวนบรรทัดที่มีข้อความ", value: lines.length },
  ];
  if (extracted.truncated) metrics.push({ metric: "หมายเหตุ", value: "เนื้อหาไฟล์ถูกตัดเนื่องจากมีขนาดใหญ่" });
  return metrics;
}

function contentPreview(extracted: ExtractedFileContent): string {
  if (extracted.kind === "rows") {
    const header = extracted.columns.join(" | ");
    const sample = extracted.rows.slice(0, 20).map((row) => extracted.columns.map((column) => String(row[column] ?? "")).join(" | "));
    return [header, ...sample].join("\n");
  }
  return extracted.text.slice(0, 6000);
}

export interface ReportSummaryInput {
  projectName: string;
  department: string;
  notes: string;
  fileName: string;
  extracted: ExtractedFileContent;
  metrics: ReportMetric[];
}

export interface ReportSummaryResult {
  summary: string;
  usedAi: boolean;
  fallbackReason?: string;
}

function deterministicSummary(input: ReportSummaryInput): string {
  const lines = [
    `# ${input.projectName}`,
    "",
    `หน่วยงาน: ${input.department}`,
    `ไฟล์ต้นทาง: ${input.fileName}`,
    "",
    ...input.metrics.map((item) => `- ${item.metric}: ${item.value}`),
  ];
  if (input.notes) lines.push("", `หมายเหตุที่ระบุ: ${input.notes}`);
  return lines.join("\n");
}

export async function summarizeReport(input: ReportSummaryInput, env: NodeJS.ProcessEnv = process.env): Promise<ReportSummaryResult> {
  const baseUrl = env.OPENAI_BASE_URL;
  if (!baseUrl) return { summary: deterministicSummary(input), usedAi: false, fallbackReason: "OPENAI_BASE_URL is not configured" };

  try {
    const system = [
      "คุณคือ senior business analyst ที่เขียนรายงานบริษัทภาษาไทยสำหรับผู้บริหาร",
      "ใช้เฉพาะข้อมูลจริงที่ให้มาเท่านั้น ห้ามสร้างตัวเลขหรือข้อเท็จจริงใหม่",
      "เขียนเป็น Markdown แบบ executive report มีหัวข้อ: ภาพรวม, ประเด็นสำคัญ, ความหมายต่อธุรกิจ, ข้อควรตรวจทาน",
      "สั้น กระชับ แต่ต้องอ่านเหมือนรายงานมืออาชีพ ไม่ใช่ log หรือ raw summary",
      "ความยาวไม่เกิน 450 คำ",
    ].join(" ");
    const user = [
      `ชื่อโครงการ: ${input.projectName}`,
      `หน่วยงาน: ${input.department}`,
      `ไฟล์: ${input.fileName}`,
      input.notes ? `คำอธิบายเพิ่มเติมจากผู้ใช้: ${input.notes}` : "",
      "",
      "ข้อมูลสำคัญที่คำนวณได้จริงจากไฟล์:",
      ...input.metrics.map((item) => `- ${item.metric}: ${item.value}`),
      "",
      "ตัวอย่างเนื้อหาไฟล์:",
      contentPreview(input.extracted),
    ].filter(Boolean).join("\n");

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.OPENAI_API_KEY ? { authorization: `Bearer ${env.OPENAI_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL ?? "qwen3.5-35b-a3b",
        ...(env.OPENAI_REASONING_EFFORT ? { reasoning_effort: env.OPENAI_REASONING_EFFORT } : {}),
        max_tokens: Number(env.OPENAI_MAX_TOKENS ?? 1024),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!response.ok) throw new Error(`Model endpoint returned HTTP ${response.status}`);
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Model returned empty content");
    return { summary: content, usedAi: true };
  } catch (error) {
    console.error("[report-ai] summarization failed, using deterministic summary:", error);
    return {
      summary: deterministicSummary(input),
      usedAi: false,
      fallbackReason: error instanceof Error ? error.message : "Model request failed",
    };
  }
}
