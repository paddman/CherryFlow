import type { WorkflowInput } from "@cherryflow/ui-schema";
import type { WorkflowTemplateMetadata } from "../types.js";

export interface TaskTemplateSpec extends WorkflowTemplateMetadata {
  id: string;
  name: string;
  description: string;
  role: string;
  instructions: string;
  inputs: WorkflowInput[];
  fileField?: string;
}

export const priorityOptions = [
  { label: "เร่งด่วน", value: "urgent" },
  { label: "สูง", value: "high" },
  { label: "ปกติ", value: "normal" },
  { label: "ต่ำ", value: "low" },
];

export const toneOptions = [
  { label: "ทางการ", value: "formal" },
  { label: "มืออาชีพ อ่านง่าย", value: "professional" },
  { label: "กระชับ ตรงประเด็น", value: "concise" },
  { label: "เป็นมิตร", value: "friendly" },
];

export function text(name: string, label: string, required = false, placeholder?: string): WorkflowInput {
  return { name, label, type: "text", required, ...(placeholder ? { placeholder } : {}) };
}

export function area(name: string, label: string, required = false, placeholder?: string): WorkflowInput {
  return { name, label, type: "textarea", required, ...(placeholder ? { placeholder } : {}) };
}

export function date(name: string, label: string, required = false): WorkflowInput {
  return { name, label, type: "date", required };
}

export function select(name: string, label: string, options: Array<{ label: string; value: string }>, required = false): WorkflowInput {
  return { name, label, type: "select", options, required };
}

export function upload(name: string, label: string, accept: string[], required = false): WorkflowInput {
  return { name, label, type: "file", accept, required };
}
