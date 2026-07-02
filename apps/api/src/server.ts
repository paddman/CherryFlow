import { createServer } from "node:http";
import type { UiSchema, WorkflowContract } from "@cherryflow/ui-schema";
import { validateUiSchema } from "@cherryflow/ui-schema";

const port = Number(process.env.CHERRYFLOW_API_PORT ?? 4000);

const reportWorkflow: WorkflowContract = {
  id: "report-generator",
  name: "AI Report Generator",
  inputs: [
    { name: "projectName", label: "ชื่อโครงการ", type: "text", required: true },
    { name: "sourceFile", label: "ไฟล์ข้อมูล", type: "file", required: true, accept: [".xlsx", ".csv", ".pdf"] },
  ],
  outputs: [
    { name: "summary", label: "สรุปผล", type: "markdown" },
    { name: "reportFile", label: "ดาวน์โหลดรายงาน", type: "file" },
  ],
};

function generateUiSchema(prompt: string): UiSchema {
  const dashboard = prompt.toLowerCase().includes("dashboard");

  return {
    version: "1.0",
    workflowId: reportWorkflow.id,
    page: {
      title: "ระบบสร้างรายงานด้วย AI",
      layout: dashboard ? "dashboard" : "centered",
      components: [
        {
          type: "hero",
          title: "สร้างรายงานอัตโนมัติ",
          description: "อัปโหลดข้อมูล แล้วให้ CherryFlow ประมวลผลเป็นรายงาน",
        },
        {
          type: "workflow-form",
          fields: reportWorkflow.inputs.map((input) => input.name),
          submitLabel: "สร้างรายงาน",
        },
        { type: "job-progress" },
        {
          type: "workflow-output",
          bindings: reportWorkflow.outputs.map((output) => output.name),
        },
      ],
    },
  };
}

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "content-type");

  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200).end(JSON.stringify({ status: "ok", service: "cherryflow-api" }));
    return;
  }

  if (request.method === "GET" && request.url === "/api/workflows/report-generator") {
    response.writeHead(200).end(JSON.stringify(reportWorkflow));
    return;
  }

  if (request.method === "POST" && request.url === "/api/workflows/report-generator/ui/generate") {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));

    let prompt = "";
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { prompt?: string };
      prompt = body.prompt ?? "";
    } catch {
      response.writeHead(400).end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }

    const schema = generateUiSchema(prompt);
    const errors = validateUiSchema(schema, reportWorkflow);

    response.writeHead(errors.length === 0 ? 200 : 422).end(
      JSON.stringify({ schema, validation: { valid: errors.length === 0, errors } }),
    );
    return;
  }

  response.writeHead(404).end(JSON.stringify({ error: "Not found" }));
});

server.listen(port, () => {
  console.log(`CherryFlow API listening on http://localhost:${port}`);
});
