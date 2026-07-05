import type { ExtractedFileContent } from "./file-content.js";
import type { ReportMetric } from "./report-ai.js";

export type ReportFormat = "pdf" | "html" | "docx" | "pptx";
export type ReportTemplate = "auto" | "corporate" | "dashboard" | "presentation" | "interactive";

export interface ReportTheme {
  name: string;
  accentColor: string;
  accentDark: string;
  surfaceColor: string;
  backgroundColor: string;
}

export interface ReportKpi {
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "positive" | "warning" | "critical";
}

export interface ReportChart {
  id: string;
  title: string;
  type: "bar" | "summary";
  unit?: string;
  insight: string;
  data: Array<{ label: string; value: number }>;
}

export interface ReportSection {
  id: string;
  title: string;
  body: string;
  bullets: string[];
}

export interface ReportTable {
  title: string;
  columns: string[];
  rows: Array<Record<string, string | number | boolean>>;
}

export interface ReportRisk {
  title: string;
  level: "low" | "medium" | "high";
  mitigation: string;
}

export interface ReportRecommendation {
  title: string;
  detail: string;
  priority: "now" | "next" | "later";
}

export interface ReportFlowNode {
  id: string;
  label: string;
  detail: string;
  status: "completed" | "running" | "planned";
  kind: "input" | "extract" | "analyze" | "compose" | "render" | "output";
}

export interface ReportFlowEdge {
  from: string;
  to: string;
  label?: string;
}

export interface ReportFlow {
  title: string;
  description: string;
  nodes: ReportFlowNode[];
  edges: ReportFlowEdge[];
}

export interface ReportDocumentModel {
  kind: "report";
  title: string;
  subtitle: string;
  department: string;
  audience: string;
  fileName: string;
  generatedAt: string;
  outputFormat: ReportFormat;
  template: ReportTemplate;
  theme: ReportTheme;
  aiStatus: string;
  summaryMarkdown: string;
  tableOfContents: Array<{ id: string; title: string; kind: string }>;
  flow: ReportFlow;
  kpis: ReportKpi[];
  metrics: ReportMetric[];
  charts: ReportChart[];
  sections: ReportSection[];
  tables: ReportTable[];
  risks: ReportRisk[];
  recommendations: ReportRecommendation[];
  notes?: string;
  appendix: {
    sourcePreview: string;
    truncated: boolean;
    dataShape: string;
  };
}

interface BuildReportInput {
  projectName: string;
  department: string;
  notes: string;
  fileName: string;
  extracted: ExtractedFileContent;
  metrics: ReportMetric[];
  summaryMarkdown: string;
  usedAi: boolean;
  fallbackReason?: string;
  outputFormat: ReportFormat;
  reportTemplate: ReportTemplate;
}

const themes: Record<ReportTemplate, ReportTheme> = {
  auto: { name: "Auto Corporate", accentColor: "#1769e0", accentDark: "#102a5f", surfaceColor: "#ffffff", backgroundColor: "#eef5ff" },
  corporate: { name: "Corporate Blue", accentColor: "#1769e0", accentDark: "#102a5f", surfaceColor: "#ffffff", backgroundColor: "#eef5ff" },
  dashboard: { name: "Executive Dashboard", accentColor: "#0f9f7a", accentDark: "#064e3b", surfaceColor: "#ffffff", backgroundColor: "#ecfdf7" },
  presentation: { name: "Board Presentation", accentColor: "#7c3aed", accentDark: "#3b0764", surfaceColor: "#ffffff", backgroundColor: "#f5f3ff" },
  interactive: { name: "Interactive Web Report", accentColor: "#ea580c", accentDark: "#7c2d12", surfaceColor: "#ffffff", backgroundColor: "#fff7ed" },
};

export function normalizeReportTemplate(value: unknown): ReportTemplate {
  const normalized = String(value ?? "auto").trim().toLowerCase();
  if (["corporate", "company", "document"].includes(normalized)) return "corporate";
  if (["dashboard", "kpi"].includes(normalized)) return "dashboard";
  if (["presentation", "powerpoint", "slide", "slides"].includes(normalized)) return "presentation";
  if (["interactive", "html", "web"].includes(normalized)) return "interactive";
  return "auto";
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString("th-TH") : Number(value.toFixed(2)).toLocaleString("th-TH");
}

function stringify(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isDateLikeColumn(column: string): boolean {
  return /(^|[_\s-])(date|month|year|วันที่|เดือน|ปี)($|[_\s-])/i.test(column);
}

function isIdentifierColumn(column: string): boolean {
  return /(^|[_\s-])(id|uuid|order|invoice|code|รหัส|เลขที่)($|[_\s-])/i.test(column);
}

function numericColumnScore(column: string): number {
  const normalized = column.toLowerCase();
  if (/revenue|sales|amount|ยอดขาย|รายได้/.test(normalized)) return 100;
  if (/gross[_\s-]?profit|profit|margin|กำไร/.test(normalized)) return 92;
  if (/cost|ต้นทุน/.test(normalized)) return 78;
  if (/unit[_\s-]?price|price|ราคา/.test(normalized)) return 64;
  if (/units|quantity|qty|count|จำนวน/.test(normalized)) return 58;
  if (/score|คะแนน|rating/.test(normalized)) return 48;
  if (/discount|ส่วนลด/.test(normalized)) return 30;
  return 10;
}

function categoryColumnScore(column: string): number {
  const normalized = column.toLowerCase();
  if (/region|country|province|area|ภูมิภาค|จังหวัด|พื้นที่/.test(normalized)) return 100;
  if (/product|service|sku|สินค้า|บริการ/.test(normalized)) return 94;
  if (/segment|industry|กลุ่ม/.test(normalized)) return 88;
  if (/channel|source|ช่องทาง/.test(normalized)) return 82;
  if (/sales[_\s-]?owner|owner|salesperson|พนักงาน|ผู้ขาย/.test(normalized)) return 78;
  if (/department|team|หน่วยงาน|ทีม/.test(normalized)) return 72;
  if (/status|สถานะ/.test(normalized)) return 58;
  if (/customer[_\s-]?name|customer|ลูกค้า/.test(normalized)) return 42;
  return 10;
}

function numericColumns(extracted: ExtractedFileContent): string[] {
  if (extracted.kind !== "rows") return [];
  return extracted.columns
    .filter((column) => !isDateLikeColumn(column) && extracted.rows.some((row) => isNumber(row[column])))
    .sort((a, b) => numericColumnScore(b) - numericColumnScore(a));
}

function categoricalColumns(extracted: ExtractedFileContent): string[] {
  if (extracted.kind !== "rows") return [];
  return extracted.columns.filter((column) => {
    if (isIdentifierColumn(column)) return false;
    const sample = extracted.rows.map((row) => row[column]).filter((value) => stringify(value).length > 0);
    const unique = new Set(sample.map(stringify));
    const uniqueRatio = unique.size / Math.max(sample.length, 1);
    return sample.length > 0 && unique.size <= Math.max(12, sample.length * 0.75) && uniqueRatio <= 0.75 && !sample.some(isNumber);
  }).sort((a, b) => categoryColumnScore(b) - categoryColumnScore(a));
}

function sourcePreview(extracted: ExtractedFileContent): string {
  if (extracted.kind === "rows") {
    const header = extracted.columns.join(" | ");
    const rows = extracted.rows.slice(0, 15).map((row) => extracted.columns.map((column) => stringify(row[column])).join(" | "));
    return [header, ...rows].filter(Boolean).join("\n");
  }
  return extracted.text.slice(0, 4200);
}

function buildKpis(extracted: ExtractedFileContent, metrics: ReportMetric[]): ReportKpi[] {
  if (extracted.kind === "rows") {
    const numbers = numericColumns(extracted);
    const kpis: ReportKpi[] = [
      { label: "แถวข้อมูล", value: formatNumber(extracted.rows.length), detail: "จำนวน record ที่นำมาวิเคราะห์", tone: "neutral" },
      { label: "คอลัมน์", value: formatNumber(extracted.columns.length), detail: "มิติข้อมูลทั้งหมดในไฟล์", tone: "neutral" },
      { label: "ตัวชี้วัดตัวเลข", value: formatNumber(numbers.length), detail: "คอลัมน์ที่ใช้คำนวณ KPI / chart ได้", tone: numbers.length ? "positive" : "warning" },
    ];
    for (const column of numbers.slice(0, 3)) {
      const values = extracted.rows.map((row) => row[column]).filter(isNumber);
      const sum = values.reduce((total, value) => total + value, 0);
      kpis.push({ label: `${column} รวม`, value: formatNumber(sum), detail: `ค่าเฉลี่ย ${formatNumber(sum / Math.max(values.length, 1))}`, tone: "positive" });
    }
    return kpis.slice(0, 6);
  }

  const wordMetric = metrics.find((metric) => metric.metric === "จำนวนคำโดยประมาณ")?.value ?? 0;
  const lineMetric = metrics.find((metric) => metric.metric === "จำนวนบรรทัดที่มีข้อความ")?.value ?? 0;
  return [
    { label: "คำโดยประมาณ", value: String(wordMetric), detail: "ปริมาณข้อความที่ใช้สรุป", tone: "neutral" },
    { label: "บรรทัดข้อความ", value: String(lineMetric), detail: "จำนวนย่อหน้า/บรรทัดที่พบ", tone: "neutral" },
    { label: "ตัวอักษร", value: formatNumber(extracted.text.length), detail: "ขนาดเนื้อหาหลัง extract", tone: extracted.truncated ? "warning" : "positive" },
  ];
}

function aggregateByCategory(extracted: ExtractedFileContent): ReportChart | undefined {
  if (extracted.kind !== "rows") return undefined;
  const category = categoricalColumns(extracted)[0];
  const numeric = numericColumns(extracted)[0];
  if (!category || !numeric) return undefined;
  const totals = new Map<string, number>();
  for (const row of extracted.rows) {
    const label = stringify(row[category]) || "ไม่ระบุ";
    const value = row[numeric];
    if (!isNumber(value)) continue;
    totals.set(label, (totals.get(label) ?? 0) + value);
  }
  const data = [...totals.entries()]
    .map(([label, value]) => ({ label, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  if (data.length === 0) return undefined;
  const top = data[0];
  return {
    id: "category-performance",
    title: `${numeric} ตาม ${category}`,
    type: "bar",
    unit: numeric,
    insight: top
      ? `${top.label} เป็นกลุ่มที่มี ${numeric} สูงสุด (${formatNumber(top.value)}) เมื่อจัดอันดับตาม ${category}`
      : `จัดอันดับ ${category} จากผลรวมของ ${numeric} เพื่อเห็นกลุ่มที่ส่งผลต่อภาพรวมมากที่สุด`,
    data,
  };
}

function numericSummaryChart(extracted: ExtractedFileContent): ReportChart | undefined {
  if (extracted.kind !== "rows") return undefined;
  const data = numericColumns(extracted).slice(0, 6).map((column) => {
    const values = extracted.rows.map((row) => row[column]).filter(isNumber);
    const sum = values.reduce((total, value) => total + value, 0);
    return { label: column, value: Number(sum.toFixed(2)) };
  }).filter((item) => item.value !== 0);
  if (data.length === 0) return undefined;
  return {
    id: "numeric-summary",
    title: "ภาพรวมตัวชี้วัดหลัก",
    type: "summary",
    insight: data[0] ? `${data[0].label} เป็นตัวชี้วัดที่มีผลรวมสูงสุด (${formatNumber(data[0].value)}) ในชุดข้อมูลนี้` : "เปรียบเทียบผลรวมของคอลัมน์ตัวเลขเพื่อเห็น driver หลักของข้อมูล",
    data,
  };
}

function textTermChart(extracted: ExtractedFileContent): ReportChart | undefined {
  if (extracted.kind !== "text") return undefined;
  const stopWords = new Set(["และ", "หรือ", "the", "a", "an", "to", "of", "in", "is", "are", "for", "with", "จาก", "ของ", "ที่", "ใน", "ให้"]);
  const counts = new Map<string, number>();
  for (const raw of extracted.text.toLowerCase().match(/[a-zA-Zก-๙0-9]{3,}/g) ?? []) {
    if (stopWords.has(raw)) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  const data = [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  if (data.length === 0) return undefined;
  return {
    id: "term-frequency",
    title: "คำสำคัญที่พบมาก",
    type: "bar",
    insight: "ใช้ความถี่ของคำเพื่อจับประเด็นหลักของเอกสารต้นทาง",
    data,
  };
}

function buildCharts(extracted: ExtractedFileContent): ReportChart[] {
  return [aggregateByCategory(extracted), numericSummaryChart(extracted), textTermChart(extracted)].filter((chart): chart is ReportChart => Boolean(chart));
}

function sampleTable(extracted: ExtractedFileContent): ReportTable[] {
  if (extracted.kind !== "rows") return [];
  return [{
    title: "ตัวอย่างข้อมูลต้นทาง",
    columns: extracted.columns.slice(0, 8),
    rows: extracted.rows.slice(0, 10).map((row) => Object.fromEntries(extracted.columns.slice(0, 8).map((column) => [column, row[column] ?? ""]))),
  }];
}

function buildSections(input: BuildReportInput, charts: ReportChart[]): ReportSection[] {
  const baseSummary = input.summaryMarkdown.replace(/^#{1,6}\s+/gm, "").split(/\r?\n/).map((line) => line.replace(/^- /, "").trim()).filter(Boolean).slice(0, 4).join(" ");
  if (input.extracted.kind === "rows") {
    const numbers = numericColumns(input.extracted);
    const categories = categoricalColumns(input.extracted);
    const primaryChart = charts[0];
    const primaryDriver = primaryChart?.data[0];
    const secondaryDriver = primaryChart?.data[1];
    const topKpis = buildKpis(input.extracted, input.metrics).slice(3, 6);
    return [
      {
        id: "executive-summary",
        title: "บทสรุปผู้บริหาร",
        body: baseSummary || `รายงานนี้วิเคราะห์ข้อมูลจาก ${input.fileName} เพื่อสรุปภาพรวมเชิงธุรกิจ ตัวชี้วัดหลัก และประเด็นที่ควรนำไปตัดสินใจต่อ`,
        bullets: [
          `ข้อมูลมี ${formatNumber(input.extracted.rows.length)} แถว และ ${formatNumber(input.extracted.columns.length)} คอลัมน์`,
          numbers.length ? `ตัวชี้วัดที่ใช้เป็นแกนวิเคราะห์: ${numbers.slice(0, 5).join(", ")}` : "ยังไม่พบคอลัมน์ตัวเลขสำหรับคำนวณ KPI เชิงปริมาณ",
          primaryDriver ? `driver หลักที่เห็นชัดคือ ${primaryDriver.label} (${formatNumber(primaryDriver.value)}) จาก chart "${primaryChart?.title ?? "chart หลัก"}"` : categories.length ? `มิติที่ใช้จัดกลุ่ม insight: ${categories.slice(0, 4).join(", ")}` : "ข้อมูลมีลักษณะเป็นตารางทั่วไป ยังไม่มีมิติหมวดหมู่ชัดเจน",
        ],
      },
      {
        id: "dashboard-analysis",
        title: "Dashboard & KPI Analysis",
        body: charts.length ? "Dashboard นี้สรุปภาพรวมจาก KPI และ chart ที่คำนวณจากข้อมูลจริง เพื่อให้เห็นทั้งขนาดของธุรกิจและกลุ่มที่ขับเคลื่อนผลลัพธ์" : "ข้อมูลชุดนี้ยังไม่เพียงพอสำหรับสร้าง chart เชิงปริมาณ จึงเน้นการสรุปโครงสร้างและคุณภาพข้อมูล",
        bullets: [
          ...topKpis.map((kpi) => `${kpi.label}: ${kpi.value} (${kpi.detail})`),
          ...charts.map((chart) => chart.insight).slice(0, 3),
          primaryDriver && secondaryDriver ? `ช่องว่างระหว่างอันดับ 1 (${primaryDriver.label}) และอันดับ 2 (${secondaryDriver.label}) ควรถูกตรวจสอบว่าเกิดจาก volume, pricing หรือ mix ของสินค้า/ลูกค้า` : undefined,
        ].filter((item): item is string => Boolean(item)),
      },
      {
        id: "data-quality",
        title: "Data Quality & Caveats",
        body: "ข้อจำกัดของรายงานอ้างอิงจากไฟล์ที่อัปโหลดเท่านั้น หากข้อมูลถูกตัดหรือไม่ครบ ผลวิเคราะห์ควรถูกตรวจทานก่อนนำไปใช้ตัดสินใจ",
        bullets: [
          input.extracted.truncated ? "ข้อมูลถูกตัดตามขีดจำกัดของระบบ จึงควรใช้ไฟล์ที่แบ่งช่วงหรือสรุปมากขึ้น" : "ข้อมูลอยู่ภายในขีดจำกัดการประมวลผลของระบบ",
          "ระบบไม่สร้างตัวเลขใหม่เอง ตัวเลข KPI มาจากการคำนวณบนไฟล์ต้นทาง",
          input.usedAi ? "AI ช่วยเรียบเรียง narrative แต่ยังคงอ้างอิง metric ที่ระบบคำนวณได้" : `AI narrative ไม่พร้อมใช้งาน: ${input.fallbackReason ?? "ไม่ทราบสาเหตุ"}`,
        ],
      },
      {
        id: "action-plan",
        title: "Action Plan",
        body: "เปลี่ยน insight ให้เป็นงานที่ทำต่อได้ โดยเริ่มจาก driver หลักของ dashboard แล้วต่อยอดเป็นการเปรียบเทียบ trend, target และ root cause",
        bullets: [
          primaryDriver ? `เจาะ ${primaryDriver.label} เป็นกรณีแรก เพราะมีผลต่อ ${primaryChart?.title ?? "chart หลัก"} สูงสุด` : "ตรวจสอบ top category หรือ KPI ที่มีผลรวมสูงสุดจาก dashboard",
          "เพิ่มข้อมูลช่วงเวลาก่อนหน้าเพื่อทำ trend / variance analysis",
          input.notes ? `ใช้โจทย์จากผู้ใช้เป็นกรอบการตัดสินใจ: ${input.notes}` : "เพิ่ม notes เพื่อระบุ business question ที่ต้องการให้รายงานตอบ",
        ],
      },
    ];
  }

  return [
    {
      id: "executive-summary",
      title: "บทสรุปผู้บริหาร",
      body: baseSummary || `รายงานนี้สรุปสาระสำคัญจากเอกสาร ${input.fileName}`,
      bullets: [
        "สกัดข้อความจากเอกสารต้นทางและสรุปเป็น narrative สำหรับผู้บริหาร",
        input.usedAi ? "AI ช่วยจัดลำดับประเด็นสำคัญจากเนื้อหาที่ extract ได้" : `ใช้ deterministic summary เพราะ AI ไม่พร้อม: ${input.fallbackReason ?? "ไม่ทราบสาเหตุ"}`,
      ],
    },
    {
      id: "document-analysis",
      title: "Document Analysis",
      body: "ระบบวิเคราะห์ปริมาณเนื้อหา คำสำคัญ และประเด็นซ้ำ เพื่อจัดหมวดเป็นรายงานอ่านง่าย",
      bullets: charts.map((chart) => chart.insight).slice(0, 4),
    },
    {
      id: "key-themes",
      title: "Key Themes",
      body: "หัวข้อที่พบซ้ำในเอกสารควรถูกใช้เป็นแกนสำหรับการสื่อสารหรือแผนงานต่อเนื่อง",
      bullets: ["จัดกลุ่มคำสำคัญเป็น theme", "ตรวจทานบริบทของข้อความก่อนใช้เป็นข้อสรุปสุดท้าย", input.notes ? `พิจารณาโจทย์ผู้ใช้: ${input.notes}` : "เพิ่ม notes เพื่อให้สรุปเน้นประเด็นที่ต้องการ"],
    },
  ];
}

function buildRisks(input: BuildReportInput): ReportRisk[] {
  const risks: ReportRisk[] = [];
  if (input.extracted.truncated) risks.push({ title: "ข้อมูลถูกตัดบางส่วน", level: "medium", mitigation: "แบ่งไฟล์เป็นช่วงหรือเพิ่มขีดจำกัด ingestion ก่อนใช้งานเชิงตัดสินใจ" });
  if (!input.usedAi) risks.push({ title: "AI narrative ไม่พร้อม", level: "low", mitigation: "ตรวจ endpoint/model token หรือใช้ deterministic report เป็น baseline" });
  if (input.extracted.kind === "rows" && numericColumns(input.extracted).length === 0) risks.push({ title: "ไม่พบ KPI เชิงตัวเลข", level: "medium", mitigation: "เพิ่มคอลัมน์ตัวเลข เช่น amount, count, score, revenue เพื่อให้ dashboard สมบูรณ์ขึ้น" });
  if (risks.length === 0) risks.push({ title: "ความเสี่ยงต่ำ", level: "low", mitigation: "ตรวจทานข้อมูลและสมมติฐานก่อนเผยแพร่ตามกระบวนการปกติ" });
  return risks;
}

function buildRecommendations(input: BuildReportInput, charts: ReportChart[]): ReportRecommendation[] {
  const primary = charts[0]?.data[0];
  return [
    { title: "ตรวจสอบ driver หลัก", detail: primary ? `เริ่มจาก ${primary.label} เพราะเป็นกลุ่มที่มีผลสูงสุดใน chart หลัก แล้วแยกดู volume, price, cost และ margin` : "เริ่มจาก KPI card และ metric table เพื่อระบุ driver หลักของรายงาน", priority: "now" },
    { title: "เพิ่มข้อมูลเปรียบเทียบ", detail: "เพิ่มข้อมูลรอบก่อนหน้า เป้าหมาย หรือ budget เพื่อให้รายงานเปลี่ยนจาก descriptive เป็น decision-grade", priority: "next" },
    { title: "จัดทำ recurring report", detail: "กำหนด schema ไฟล์มาตรฐานเพื่อสร้าง report แบบอัตโนมัติในรอบถัดไป", priority: "later" },
    ...(input.notes ? [{ title: "ตอบโจทย์เฉพาะผู้ใช้", detail: input.notes, priority: "now" as const }] : []),
  ];
}

function buildFlow(input: BuildReportInput, charts: ReportChart[]): ReportFlow {
  const dataShape = input.extracted.kind === "rows"
    ? `${formatNumber(input.extracted.rows.length)} rows × ${formatNumber(input.extracted.columns.length)} columns`
    : `${formatNumber(input.extracted.text.length)} characters`;
  const chartSummary = charts.length
    ? `${formatNumber(charts.length)} visual analysis block${charts.length > 1 ? "s" : ""}`
    : "KPI/structure analysis without charts";
  const nodes: ReportFlowNode[] = [
    {
      id: "source-input",
      label: "Source Input",
      detail: `รับไฟล์ ${input.fileName} พร้อมโจทย์รายงานและ format ที่ต้องการ`,
      status: "completed",
      kind: "input",
    },
    {
      id: "content-extract",
      label: "Extract Content",
      detail: input.extracted.kind === "rows"
        ? `อ่านข้อมูลตารางเป็น ${dataShape} และ normalize ค่าเพื่อคำนวณต่อ`
        : `สกัดข้อความเป็น ${dataShape} สำหรับสรุปและหา theme`,
      status: "completed",
      kind: "extract",
    },
    {
      id: "metric-analysis",
      label: "Analyze Metrics",
      detail: `คำนวณ KPI, data quality และสร้าง ${chartSummary}`,
      status: "completed",
      kind: "analyze",
    },
    {
      id: "report-compose",
      label: "Compose Narrative",
      detail: input.usedAi
        ? "ใช้ AI ช่วยเรียบเรียง insight โดยยึด metric จากไฟล์จริง"
        : `ใช้ deterministic composer เพราะ AI ไม่พร้อม: ${input.fallbackReason ?? "unknown"}`,
      status: "completed",
      kind: "compose",
    },
    {
      id: "render-output",
      label: "Render Report",
      detail: `จัด layout แบบ ${input.reportTemplate === "auto" ? "auto-selected" : input.reportTemplate} และ export เป็น ${input.outputFormat.toUpperCase()}`,
      status: "completed",
      kind: "render",
    },
    {
      id: "publish-result",
      label: "Return Result",
      detail: "ส่งไฟล์ดาวน์โหลด, preview, dashboard, recommendations และ appendix กลับไปที่ Results",
      status: "completed",
      kind: "output",
    },
  ];

  return {
    title: "CherryFlow Report Workflow",
    description: "เส้นทางการทำงานของ report.compose ตั้งแต่รับไฟล์จนเป็นรายงานที่ export ได้",
    nodes,
    edges: [
      { from: "source-input", to: "content-extract", label: "file payload" },
      { from: "content-extract", to: "metric-analysis", label: "normalized data" },
      { from: "metric-analysis", to: "report-compose", label: "KPI + insight" },
      { from: "report-compose", to: "render-output", label: "report document" },
      { from: "render-output", to: "publish-result", label: "file + preview" },
    ],
  };
}

function tableOfContents(sections: ReportSection[], charts: ReportChart[], tables: ReportTable[]): ReportDocumentModel["tableOfContents"] {
  return [
    { id: "cover", title: "หน้าปก", kind: "cover" },
    { id: "dashboard", title: "Executive Dashboard", kind: "dashboard" },
    { id: "workflow-flow", title: "Workflow Flow", kind: "flow" },
    ...sections.map((section) => ({ id: section.id, title: section.title, kind: "section" })),
    ...(charts.length ? [{ id: "charts", title: "Charts & Visual Analysis", kind: "charts" }] : []),
    ...(tables.length ? [{ id: "tables", title: "Data Tables", kind: "table" }] : []),
    { id: "recommendations", title: "Recommendations", kind: "recommendations" },
    { id: "appendix", title: "Appendix", kind: "appendix" },
  ];
}

export function buildReportDocument(input: BuildReportInput): ReportDocumentModel {
  const template = input.reportTemplate === "auto"
    ? input.outputFormat === "pptx" ? "presentation" : input.outputFormat === "html" ? "interactive" : "corporate"
    : input.reportTemplate;
  const charts = buildCharts(input.extracted);
  const sections = buildSections(input, charts);
  const tables = sampleTable(input.extracted);
  const flow = buildFlow(input, charts);
  const aiStatus = input.usedAi
    ? "สรุปโดย CherryFlow AI จากเนื้อหาไฟล์จริง"
    : `สรุปแบบอัตโนมัติจากเนื้อหาไฟล์จริง (AI ไม่พร้อมใช้งาน: ${input.fallbackReason ?? "unknown"})`;
  return {
    kind: "report",
    title: input.projectName,
    subtitle: "AI-generated business report with dashboard, insights, and action plan",
    department: input.department,
    audience: "ผู้บริหารและทีมปฏิบัติการ",
    fileName: input.fileName,
    generatedAt: new Date().toISOString(),
    outputFormat: input.outputFormat,
    template,
    theme: themes[template],
    aiStatus,
    summaryMarkdown: input.summaryMarkdown,
    tableOfContents: tableOfContents(sections, charts, tables),
    flow,
    kpis: buildKpis(input.extracted, input.metrics),
    metrics: input.metrics,
    charts,
    sections,
    tables,
    risks: buildRisks(input),
    recommendations: buildRecommendations(input, charts),
    ...(input.notes ? { notes: input.notes } : {}),
    appendix: {
      sourcePreview: sourcePreview(input.extracted),
      truncated: input.extracted.truncated,
      dataShape: input.extracted.kind === "rows"
        ? `${formatNumber(input.extracted.rows.length)} rows × ${formatNumber(input.extracted.columns.length)} columns`
        : `${formatNumber(input.extracted.text.length)} characters`,
    },
  };
}
