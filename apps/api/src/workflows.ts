import type { WorkflowDefinition } from "./types.js";

const reportGenerator: WorkflowDefinition = {
  contract: {
    id: "report-generator",
    name: "AI Report Generator",
    description: "Upload a source file and generate a structured report package.",
    inputs: [
      { name: "projectName", label: "ชื่อโครงการ", type: "text", placeholder: "เช่น รายงานยอดขายประจำเดือน", required: true },
      {
        name: "department",
        label: "หน่วยงาน",
        type: "select",
        required: true,
        options: [
          { label: "บริหาร", value: "management" },
          { label: "ปฏิบัติการ", value: "operations" },
          { label: "เทคโนโลยี", value: "technology" },
        ],
      },
      {
        name: "sourceFile",
        label: "ไฟล์ข้อมูล",
        type: "file",
        description: "รองรับ Excel, CSV, PDF และข้อความ ขนาดไม่เกิน 5 MB",
        accept: [".xlsx", ".csv", ".pdf", ".txt"],
        required: true,
      },
      {
        name: "outputFormat",
        label: "รูปแบบรายงาน",
        type: "select",
        required: true,
        options: [
          { label: "PDF", value: "pdf" },
          { label: "HTML", value: "html" },
          { label: "Word (.docx)", value: "docx" },
          { label: "PowerPoint (.pptx)", value: "pptx" },
        ],
      },
      {
        name: "reportTemplate",
        label: "เทมเพลตรายงาน",
        type: "select",
        description: "เลือก mood & layout ของรายงาน หรือปล่อย Auto ให้ระบบเลือกตาม output",
        options: [
          { label: "Auto", value: "auto" },
          { label: "Corporate Document", value: "corporate" },
          { label: "Executive Dashboard", value: "dashboard" },
          { label: "Board Presentation", value: "presentation" },
          { label: "Interactive HTML Report", value: "interactive" },
        ],
      },
      { name: "notes", label: "คำอธิบายเพิ่มเติม", type: "textarea", placeholder: "จุดที่ต้องการให้ AI เน้นเป็นพิเศษ" },
    ],
    outputs: [
      { name: "reportPreview", label: "รายงาน", type: "report" },
      { name: "summary", label: "สรุปผล", type: "markdown" },
      { name: "metrics", label: "ข้อมูลสำคัญ", type: "table" },
      { name: "reportFile", label: "ดาวน์โหลดรายงาน", type: "file" },
    ],
  },
  graph: {
    version: "1.0",
    nodes: [
      { id: "input", moduleType: "core.input" },
      { id: "inspect", moduleType: "file.inspect", config: { inputNode: "input", field: "sourceFile", maxBytes: 5242880 } },
      { id: "compose", moduleType: "report.compose", config: { inputNode: "input", fileNode: "inspect" } },
      { id: "output", moduleType: "core.output", config: { sourceNode: "compose" } },
    ],
    edges: [
      { from: "input", to: "inspect" },
      { from: "input", to: "compose" },
      { from: "inspect", to: "compose" },
      { from: "compose", to: "output" },
    ],
    outputNodeId: "output",
  },
};

const definitions = new Map<string, WorkflowDefinition>([[reportGenerator.contract.id, reportGenerator]]);

export function listWorkflows() {
  return [...definitions.values()].map((definition) => definition.contract);
}

export function getWorkflow(workflowId: string): WorkflowDefinition | undefined {
  return definitions.get(workflowId);
}
