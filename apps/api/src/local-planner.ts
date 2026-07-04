import { createDefaultTheme, type UiSchema, type WorkflowContract } from "@cherryflow/ui-schema";
import { createWebsiteComponents } from "./site-template.js";

const contains = (text: string, terms: string[]) => terms.some((term) => text.toLowerCase().includes(term));

export function createLocalSchema(prompt: string, workflow: WorkflowContract, current?: UiSchema): UiSchema {
  const text = prompt.trim().slice(0, 2000);
  const theme = structuredClone(current?.theme ?? createDefaultTheme());
  const existingWebsite = current?.page.components.some((component) => component.type === "navbar" || component.type === "footer") ?? false;
  const website = existingWebsite || contains(text, ["website", "landing", "เว็บไซต์", "หน้าเว็บ"]);
  let layout = current?.page.layout ?? (website ? "full-width" : "centered");
  let title = current?.page.title ?? workflow.name;

  if (contains(text, ["dashboard", "แดชบอร์ด"])) layout = "dashboard";
  if (contains(text, ["full width", "เต็มจอ", "website", "landing", "เว็บไซต์"])) layout = "full-width";
  if (contains(text, ["minimal", "มินิมอล"])) theme.density = "compact";
  if (contains(text, ["government", "ราชการ"])) {
    theme.primaryColor = "#1557a8";
    theme.backgroundColor = "#f2f6fb";
    title = `ระบบ${workflow.name}`;
  }
  if (contains(text, ["green", "สีเขียว"])) {
    theme.primaryColor = "#147a4b";
    theme.backgroundColor = "#effaf4";
  }
  if (contains(text, ["purple", "สีม่วง"])) {
    theme.primaryColor = "#7147d9";
    theme.backgroundColor = "#f5f1ff";
  }
  if (contains(text, ["dark", "สีเข้ม"])) {
    theme.primaryColor = "#6ea8ff";
    theme.backgroundColor = "#101827";
    theme.surfaceColor = "#18243a";
    theme.textColor = "#f4f7ff";
  }

  const components: UiSchema["page"]["components"] = website
    ? createWebsiteComponents(workflow, title)
    : [{ id: "hero", type: "hero", badge: "CHERRYFLOW AI APP", title, description: workflow.description, align: layout === "centered" ? "center" : "left" }];

  if (!website && contains(text, ["steps", "ขั้นตอน"])) {
    components.push({
      id: "steps",
      type: "steps",
      title: "ขั้นตอนการใช้งาน",
      items: [
        { title: "กรอกข้อมูล", description: "เตรียมข้อมูลให้ครบ" },
        { title: "ประมวลผล", description: "ติดตามสถานะของ Workflow" },
        { title: "รับผลลัพธ์", description: "ดูผลและดาวน์โหลดไฟล์" }
      ]
    });
  }

  if (!website) {
    components.push(
      { id: "form", type: "workflow-form", title: "ข้อมูลสำหรับประมวลผล", fields: workflow.inputs.map((input) => input.name), submitLabel: contains(text, ["report", "รายงาน"]) ? "สร้างรายงาน" : "เริ่มประมวลผล" },
      { id: "progress", type: "job-progress", title: "สถานะการทำงาน" },
      { id: "output", type: "workflow-output", title: "ผลลัพธ์", bindings: workflow.outputs.map((output) => output.name), emptyText: "ผลลัพธ์จะแสดงที่นี่" }
    );
  }

  return {
    version: "1.0",
    workflowId: workflow.id,
    meta: { name: current?.meta.name ?? `${workflow.name}${website ? " Website" : " App"}`, description: text.slice(0, 300) },
    theme,
    page: { title, subtitle: workflow.description, layout, components }
  };
}
