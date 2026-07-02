"use client";

import type { ChangeEvent } from "react";
import type { WorkflowInput, WorkflowInputValue } from "@cherryflow/ui-schema";

export function RuntimeField({ field, value, onChange }: {
  field: WorkflowInput;
  value: WorkflowInputValue | File | undefined;
  onChange: (value: WorkflowInputValue | File) => void;
}) {
  const id = `field-${field.name}`;
  return (
    <label className="field" htmlFor={id}>
      <span>{field.label} {field.required && <b className="required">*</b>}</span>
      {field.description && <small>{field.description}</small>}
      {field.type === "textarea" && <textarea id={id} placeholder={field.placeholder} required={field.required} value={typeof value === "string" ? value : ""} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)} />}
      {field.type === "select" && (
        <select id={id} required={field.required} value={typeof value === "string" ? value : ""} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}>
          <option value="">เลือก...</option>
          {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      )}
      {field.type === "boolean" && <input id={id} type="checkbox" checked={value === true} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked)} />}
      {field.type === "file" && <input id={id} type="file" accept={field.accept?.join(",")} required={field.required} onChange={(event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) onChange(file); }} />}
      {["text", "number", "date"].includes(field.type) && <input id={id} type={field.type} placeholder={field.placeholder} required={field.required} value={typeof value === "string" || typeof value === "number" ? value : ""} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(field.type === "number" ? Number(event.target.value) : event.target.value)} />}
    </label>
  );
}
