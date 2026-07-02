import { createDefaultTheme, type UiSchema, type WorkflowContract } from "@cherryflow/ui-schema";

const contains = (text: string, terms: string[]) => terms.some((term) => text.toLowerCase().includes(term));

export function createLocalSchema(prompt: string, workflow: WorkflowContract, current?: UiSchema): UiSchema {
  const text = prompt.trim().slice(0, 2000);
  const theme = structuredClone(current?.theme ?? createDefaultTheme());
  let layout = current?.page.layout ?? "centered";
  let title = current?.page.title ?? workflow.name;

  if (contains(text, ["dashboard", "แดชบอร์ด"])) layout = "dashboard";
  if (contains(text, ["เต็มจอ", "full width"])) layout = "full-width";
  if (contains(text, ["มินิมอล", "minimal"])) theme.density = "compact";
  if (contains(text, ["ราชการ", "government"])) {
    theme.primaryColor = "#1557a8";
    theme.backgroundColor = "#f2f6fb";
    title = `ระบบ${workflow.name}`;
  }
  if (contains(text, ["สีเขียว", "green"])) {
    theme.primaryColor = "#147a4b";
    theme.backgroundColor = "#effaf4";
  }
  if (contains(text, ["dark", "สีเข้ม"])) {
    theme.primaryColor = "#6ea8ff";
    theme.backgroundColor = "#101827";
    theme.surfaceColor = "#18243a";
    theme.textColor = "#f4f7ff";
  }

  const components: UiSchema["page"]["components"] = [
    { id: "hero", type: "hero", badge: "CHERRYFLOW AI APP", title, description: workflow.description, align: layout === "centered" ? "center" : "left" },
  ];

  if (contains(text, ["ขั้นตอน", "steps"])) {
    components.push({ id: "steps", type: "steps", title: "ขั้นตอนการใช้งาน", items: [
      { title: "กรอกข้อมูล", description: "เตรียมข้อมูลให้ครบ" },
      { title: "ประมวลผล", description: "ติดตามสถานะของ Workflow" },
      { title: "รับผลลัพธ์", description: "ดูผลและดาวน์โหลดไฟล์" },
    ] });
  }

  components.push(
    { id: "form", type: "workflow-form", title: "ข้อมูลสำหรับประมวลผล", fields: workflow.inputs.map((input) => input.name), submitLabel: contains(text, ["รายงาน", "report"]) ? "สร้างรายงาน" : "เริ่มประมวลผล" },
    { id: "progress", type: "job-progress", title: "สถานะการทำงาน" },
    { id: "output", type: "workflow-output", title: "ผลลัพธ์", bindings: workflow.outputs.map((output) => output.name), emptyText: "ผลลัพธ์จะแสดงที่นี่" },
  );

  return {
    version: "1.0",
    workflowId: workflow.id,
    meta: { name: current?.meta.name ?? `${workflow.name} App`, description: text.slice(0, 300) },
    theme,
    page: { title, subtitle: workflow.description, layout, components },
  };
}
