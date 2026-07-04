"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { UiSchema, UploadedFileValue, WorkflowContract, WorkflowInputValue, WorkflowInputValues, WorkflowRun } from "@cherryflow/ui-schema";
import { requestJson } from "../lib/client";
import { RuntimeField } from "./RuntimeField";
import { RuntimeOutput } from "./RuntimeOutput";
import { StaticSection } from "./StaticSection";

async function fileValue(file: File): Promise<UploadedFileValue> {
  if (file.size > 5 * 1024 * 1024) throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
  return { name: file.name, type: file.type, size: file.size, dataUrl };
}

export function SchemaRenderer({ schema, workflow, runPath, publicMode = false }: {
  schema: UiSchema;
  workflow: WorkflowContract;
  runPath: string;
  publicMode?: boolean;
}) {
  const [values, setValues] = useState<Record<string, WorkflowInputValue | File>>({});
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const style = useMemo(() => ({
    "--cf-primary": schema.theme.primaryColor,
    "--cf-background": schema.theme.backgroundColor,
    "--cf-surface": schema.theme.surfaceColor,
    "--cf-text": schema.theme.textColor,
    "--cf-radius": schema.theme.radius === "small" ? "10px" : schema.theme.radius === "medium" ? "16px" : "24px",
    "--cf-gap": schema.theme.density === "compact" ? "16px" : "26px",
  }) as CSSProperties, [schema.theme]);

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const inputs: WorkflowInputValues = {};
      for (const field of workflow.inputs) {
        const value = values[field.name];
        if (field.required && (value === undefined || value === "" || value === null)) throw new Error(`กรุณากรอก ${field.label}`);
        inputs[field.name] = value instanceof File ? await fileValue(value) : (value ?? null);
      }
      const created = await requestJson<{ run: WorkflowRun }>(runPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inputs }),
      });
      setRun(created.run);
      for (let attempt = 0; attempt < 90; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        const current = await requestJson<{ run: WorkflowRun }>(`/api/runs/${created.run.id}`);
        setRun(current.run);
        if (current.run.status === "completed" || current.run.status === "failed") break;
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to run workflow");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={`schemaRuntime layout-${schema.page.layout} ${publicMode ? "publicMode" : "previewMode"}`} style={style}>
      <div className="runtimeCanvas">
        {schema.page.components.map((component) => {
          if (component.type === "workflow-form") return (
            <section id={component.id} className="contentCard formCard" key={component.id}>
              {component.title && <h2>{component.title}</h2>}
              {component.description && <p className="muted">{component.description}</p>}
              <div className="formGrid">{component.fields.map((name) => {
                const field = workflow.inputs.find((item) => item.name === name);
                return field ? <RuntimeField key={name} field={field} value={values[name]} onChange={(value) => setValues((current) => ({ ...current, [name]: value }))} /> : null;
              })}</div>
              <button className="primaryButton" type="button" onClick={submit} disabled={submitting}>{submitting ? "กำลังประมวลผล..." : component.submitLabel}</button>
              {error && <p className="errorMessage">{error}</p>}
            </section>
          );

          if (component.type === "job-progress") return (
            <section id={component.id} className="contentCard progressCard" key={component.id}>
              <div>
                <h2>{component.title ?? "สถานะ"}</h2>
                <p>{run ? `Run ID: ${run.id}` : "ยังไม่ได้เริ่ม"}</p>
                {run?.steps && run.steps.length > 0 && <ul className="nodeSteps">{run.steps.map((step, index) => <li key={`${step.nodeId}-${step.status}-${index}`}><span>{step.nodeId}</span><small>{step.moduleType}</small><strong className={`step-${step.status}`}>{step.status}</strong></li>)}</ul>}
              </div>
              <span className={`status status-${run?.status ?? "idle"}`}>{run?.status ?? "idle"}</span>
            </section>
          );

          if (component.type === "workflow-output") return (
            <section id={component.id} className="contentCard outputCard" key={component.id}><h2>{component.title ?? "ผลลัพธ์"}</h2>
              {!run?.outputs && <p className="muted">{component.emptyText ?? "ยังไม่มีผลลัพธ์"}</p>}
              {component.bindings.map((binding) => { const output = workflow.outputs.find((item) => item.name === binding); return output && run?.outputs ? <article className="outputBlock" key={binding}><h3>{output.label}</h3><RuntimeOutput value={run.outputs[binding]} /></article> : null; })}
              {run?.status === "failed" && <p className="errorMessage">{run.error}</p>}
            </section>
          );

          return <StaticSection key={component.id} component={component} />;
        })}
      </div>
    </main>
  );
}
