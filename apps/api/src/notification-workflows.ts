import type { WorkflowInput, WorkflowOutput } from "@cherryflow/ui-schema";
import type { WorkflowDefinition } from "./types.js";

const severityOptions = [
  { label: "ข้อมูล", value: "info" },
  { label: "สำเร็จ", value: "success" },
  { label: "คำเตือน", value: "warning" },
  { label: "วิกฤต", value: "critical" },
];

const notificationOutputs: WorkflowOutput[] = [
  { name: "result", label: "ผลการส่ง", type: "markdown" },
  { name: "summary", label: "สรุป", type: "markdown" },
  { name: "checklist", label: "สถานะแต่ละช่องทาง", type: "table" },
  { name: "nextSteps", label: "ขั้นตอนถัดไป", type: "markdown" },
  { name: "aiStatus", label: "สถานะ Connector", type: "text" },
];

function baseInputs(): WorkflowInput[] {
  return [
    { name: "title", label: "หัวข้อแจ้งเตือน", type: "text", required: true, placeholder: "เช่น ระบบสำรองข้อมูลเสร็จสมบูรณ์" },
    { name: "message", label: "ข้อความ", type: "textarea", required: true, placeholder: "รายละเอียดที่ต้องการส่ง โดยไม่ใส่ Token หรือ Secret" },
    { name: "severity", label: "ระดับ", type: "select", required: true, options: severityOptions },
    { name: "dryRun", label: "Dry Run", type: "boolean", description: "ตรวจข้อความและปลายทางโดยไม่เรียก Provider จริง" },
    { name: "confirmSend", label: "ยืนยันการส่งจริง", type: "boolean", description: "ต้องเปิดเมื่อปิด Dry Run และต้องการส่งออกนอกระบบ" },
  ];
}

function definition(
  id: string,
  name: string,
  description: string,
  moduleType: string,
  icon: string,
  inputs: WorkflowInput[],
  tags: string[],
  featured = false,
): WorkflowDefinition {
  return {
    contract: { id, name, description, inputs, outputs: notificationOutputs },
    graph: {
      version: "1.0",
      nodes: [
        { id: "input", moduleType: "core.input" },
        { id: "notify", moduleType, config: { inputNode: "input" } },
        { id: "output", moduleType: "core.output", config: { sourceNode: "notify" } },
      ],
      edges: [
        { from: "input", to: "notify" },
        { from: "notify", to: "output" },
      ],
      outputNodeId: "output",
    },
    template: {
      category: "integrations",
      icon,
      tags,
      featured,
      estimatedMinutes: 3,
      requiresFile: false,
      starterPrompt: `สร้างหน้าส่ง ${name} ภาษาไทย มีหัวข้อ ข้อความ ระดับ Dry Run การยืนยันก่อนส่ง และตารางสถานะการส่ง`,
    },
  };
}

const telegram = definition(
  "telegram-notification",
  "Telegram Bot Notification",
  "ส่งข้อความแจ้งเตือนผ่าน Telegram Bot API โดย Token อยู่ฝั่ง Server รองรับ Dry Run, Silent Message, การยืนยัน และแบ่งข้อความยาวอัตโนมัติ",
  "notify.telegram",
  "TG",
  [
    ...baseInputs(),
    {
      name: "telegramChatId",
      label: "Telegram Chat ID",
      type: "text",
      description: "เว้นว่างเพื่อใช้ TELEGRAM_CHAT_ID จาก Server",
      placeholder: "เช่น -1001234567890",
    },
    { name: "silent", label: "ส่งแบบไม่แจ้งเตือนเสียง", type: "boolean" },
  ],
  ["Telegram", "Bot API", "Notification", "ChatOps"],
  true,
);

const discord = definition(
  "discord-webhook-notification",
  "Discord Webhook Notification",
  "ส่งข้อความผ่าน Discord Incoming Webhook ที่เก็บ URL ไว้ฝั่ง Server พร้อมปิด Allowed Mentions เพื่อไม่ให้ข้อความ Trigger @everyone โดยไม่ตั้งใจ",
  "notify.discord",
  "DS",
  baseInputs(),
  ["Discord", "Webhook", "Notification", "ChatOps"],
  true,
);

const line = definition(
  "line-oa-push-notification",
  "LINE Official Account Push",
  "ส่ง Push Message ผ่าน LINE Messaging API โดยใช้ Channel Access Token ฝั่ง Server ไม่ใช้บริการ LINE Notify ที่ยุติแล้ว",
  "notify.line",
  "LN",
  [
    ...baseInputs(),
    {
      name: "lineTo",
      label: "LINE User / Group / Room ID",
      type: "text",
      description: "เว้นว่างเพื่อใช้ LINE_TO จาก Server",
      placeholder: "เช่น Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    },
  ],
  ["LINE", "Messaging API", "Official Account", "Notification"],
  true,
);

const multiChannel = definition(
  "multi-channel-notification",
  "Telegram + Discord + LINE Dispatch",
  "ส่งข้อความเดียวไปหลายช่องทาง พร้อมรายงานผลแยก Telegram, Discord และ LINE โดยช่องทางที่ล้มเหลวจะไม่กลบผลของช่องทางอื่น",
  "notify.dispatch",
  "ALL",
  [
    ...baseInputs(),
    { name: "sendTelegram", label: "ส่ง Telegram", type: "boolean" },
    { name: "sendDiscord", label: "ส่ง Discord", type: "boolean" },
    { name: "sendLine", label: "ส่ง LINE", type: "boolean" },
    {
      name: "telegramChatId",
      label: "Telegram Chat ID",
      type: "text",
      description: "เว้นว่างเพื่อใช้ TELEGRAM_CHAT_ID จาก Server",
    },
    {
      name: "lineTo",
      label: "LINE User / Group / Room ID",
      type: "text",
      description: "เว้นว่างเพื่อใช้ LINE_TO จาก Server",
    },
    { name: "silent", label: "Telegram แบบไม่แจ้งเตือนเสียง", type: "boolean" },
  ],
  ["Telegram", "Discord", "LINE", "Multi-channel"],
  true,
);

export const notificationWorkflowDefinitions: WorkflowDefinition[] = [telegram, discord, line, multiChannel];
