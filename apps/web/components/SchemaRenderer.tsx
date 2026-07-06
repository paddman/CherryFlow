"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { FileOutputValue, UiSchema, UploadedFileValue, WorkflowContract, WorkflowInputValue, WorkflowInputValues, WorkflowOutputValue, WorkflowRun } from "@cherryflow/ui-schema";
import { requestJson } from "../lib/client";
import { RuntimeField } from "./RuntimeField";
import { RuntimeOutput } from "./RuntimeOutput";
import { StaticSection } from "./StaticSection";

function fieldsForComponent(componentFields: string[], workflow: WorkflowContract): string[] {
  const existing = new Set(componentFields);
  const missing = workflow.inputs.map((field) => field.name).filter((name) => !existing.has(name));
  return [...componentFields, ...missing];
}

function bindingsForComponent(componentBindings: string[], workflow: WorkflowContract): string[] {
  const existing = new Set(componentBindings);
  const missing = workflow.outputs.map((output) => output.name).filter((name) => !existing.has(name));
  const ordered = [...componentBindings, ...missing];
  return ordered.includes("reportPreview")
    ? ["reportPreview", ...ordered.filter((name) => name !== "reportPreview")]
    : ordered;
}

function isFileOutput(value: WorkflowOutputValue | undefined): value is FileOutputValue {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && ("url" in value || "dataUrl" in value) && "name" in value);
}

function PrimaryDownload({ file }: { file: FileOutputValue }) {
  const href = file.url ?? file.dataUrl;
  if (!href) return null;
  const label = file.mimeType === "application/pdf" ? "ดาวน์โหลดรายงาน PDF" : "ดาวน์โหลดรายงาน";
  return (
    <div className="primaryDownloadPanel">
      <div>
        <span>ไฟล์พร้อมดาวน์โหลด</span>
        <strong>{file.name}</strong>
        <small>{file.mimeType}</small>
      </div>
      <a className="downloadButton" href={href} download={file.name}>{label}</a>
    </div>
  );
}

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

function formatStepTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function RunFlow({ run }: { run: WorkflowRun }) {
  const steps = run.steps ?? [];
  return (
    <div className="runFlow">
      <div className="runFlowHeader">
        <div>
          <span>CherryFlow execution</span>
          <strong>Workflow run flow</strong>
          <small>Run ID: {run.id}</small>
        </div>
        <em className={`status status-${run.status}`}>{run.status}</em>
      </div>
      {steps.length > 0 ? (
        <ol className="runFlowTrack">
          {steps.map((step, index) => (
            <li className={`runFlowStep step-${step.status}`} key={`${step.nodeId}-${step.status}-${index}`}>
              <span className="runFlowIndex">{index + 1}</span>
              <div>
                <strong>{step.nodeId}</strong>
                <small>{step.moduleType}</small>
                {step.error && <p>{step.error}</p>}
              </div>
              <em>{step.status}</em>
              <time>{formatStepTime(step.at)}</time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">รอ step events จาก workflow engine...</p>
      )}
    </div>
  );
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
  const hasProgressComponent = useMemo(() => schema.page.components.some((component) => component.type === "job-progress"), [schema.page.components]);

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
              <div className="formGrid">{fieldsForComponent(component.fields, workflow).map((name) => {
                const field = workflow.inputs.find((item) => item.name === name);
                return field ? <RuntimeField key={name} field={field} value={values[name]} onChange={(value) => setValues((current) => ({ ...current, [name]: value }))} /> : null;
              })}</div>
              <button className="primaryButton" type="button" onClick={submit} disabled={submitting}>{submitting ? "กำลังประมวลผล..." : component.submitLabel}</button>
              {error && <p className="errorMessage">{error}</p>}
            </section>
          );

          if (component.type === "job-progress") return (
            <section id={component.id} className="contentCard progressCard" key={component.id}>
              <div className="progressCardHeader">
                <h2>{component.title ?? "สถานะ"}</h2>
                {!run && <p>ยังไม่ได้เริ่ม</p>}
              </div>
              {run ? <RunFlow run={run} /> : <span className="status status-idle">idle</span>}
            </section>
          );

          if (component.type === "workflow-output") return (
            <section id={component.id} className="contentCard outputCard" key={component.id}><h2>{component.title ?? "ผลลัพธ์"}</h2>
              {!run?.outputs && <p className="muted">{component.emptyText ?? "ยังไม่มีผลลัพธ์"}</p>}
              {run && !hasProgressComponent && <RunFlow run={run} />}
              {isFileOutput(run?.outputs?.reportFile) && <PrimaryDownload file={run.outputs.reportFile} />}
              {bindingsForComponent(component.bindings, workflow).map((binding) => { const output = workflow.outputs.find((item) => item.name === binding); return output && run?.outputs ? <article className={`outputBlock output-${binding}`} key={binding}><h3>{output.label}</h3><RuntimeOutput value={run.outputs[binding]} /></article> : null; })}
              {run?.status === "failed" && <p className="errorMessage">{run.error}</p>}
            </section>
          );

          return <StaticSection key={component.id} component={component} />;
        })}
      </div>
    </main>
  );
}
