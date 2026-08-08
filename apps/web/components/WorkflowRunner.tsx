"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import type { UploadedFileValue, WorkflowContract, WorkflowInput, WorkflowInputValue, WorkflowInputValues, WorkflowRun } from "@cherryflow/ui-schema";
import { requestJson } from "../lib/client";
import { RuntimeOutput } from "./RuntimeOutput";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function initialValue(input: WorkflowInput): WorkflowInputValue {
  if (input.type === "boolean") return false;
  if (input.type === "number") return null;
  if (input.type === "select") return input.options?.[0]?.value ?? "";
  return "";
}

function fileAsValue(file: File): Promise<UploadedFileValue> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`อ่านไฟล์ ${file.name} ไม่สำเร็จ`));
    reader.onload = () => resolve({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      dataUrl: String(reader.result ?? ""),
    });
    reader.readAsDataURL(file);
  });
}

function isEmpty(value: WorkflowInputValue | undefined): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

function statusLabel(status: WorkflowRun["status"] | undefined): string {
  if (status === "queued") return "อยู่ในคิว";
  if (status === "running") return "กำลังประมวลผล";
  if (status === "completed") return "เสร็จสมบูรณ์";
  if (status === "failed") return "ทำงานไม่สำเร็จ";
  return "พร้อมเริ่มงาน";
}

export function WorkflowRunner({ workflowId }: { workflowId: string }) {
  const [workflow, setWorkflow] = useState<WorkflowContract | null>(null);
  const [values, setValues] = useState<WorkflowInputValues>({});
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    requestJson<WorkflowContract>(`/api/workflows/${workflowId}`)
      .then((contract) => {
        setWorkflow(contract);
        setValues(Object.fromEntries(contract.inputs.map((input) => [input.name, initialValue(input)])));
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "โหลด Workflow ไม่สำเร็จ"));
  }, [workflowId]);

  const completedOutputs = useMemo(() => run?.status === "completed" ? run.outputs : undefined, [run]);

  function setValue(name: string, value: WorkflowInputValue) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function onFileChange(input: WorkflowInput, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      event.target.value = "";
      setError(`ไฟล์ ${file.name} ใหญ่เกิน 5 MB`);
      return;
    }
    setError("");
    setValue(input.name, await fileAsValue(file));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workflow || busy) return;
    const missing = workflow.inputs.filter((input) => input.required && isEmpty(values[input.name]));
    if (missing.length > 0) {
      setError(`กรอกข้อมูลที่จำเป็น: ${missing.map((input) => input.label).join(", ")}`);
      return;
    }

    setBusy(true);
    setError("");
    setRun(null);
    try {
      const created = await requestJson<{ run: WorkflowRun }>(`/api/workflows/${workflowId}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inputs: values }),
      });
      setRun(created.run);

      for (let attempt = 0; attempt < 120; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        const current = await requestJson<{ run: WorkflowRun }>(`/api/runs/${created.run.id}`);
        setRun(current.run);
        if (current.run.status === "completed" || current.run.status === "failed") break;
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Workflow ทำงานไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function renderInput(input: WorkflowInput) {
    const value = values[input.name];
    if (input.type === "textarea") {
      return <textarea value={typeof value === "string" ? value : ""} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setValue(input.name, event.target.value)} placeholder={input.placeholder} required={input.required} />;
    }
    if (input.type === "select") {
      return (
        <select value={typeof value === "string" ? value : ""} onChange={(event: ChangeEvent<HTMLSelectElement>) => setValue(input.name, event.target.value)} required={input.required}>
          {(input.options ?? []).map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
      );
    }
    if (input.type === "boolean") {
      return <label className="runnerSwitch"><input type="checkbox" checked={value === true} onChange={(event: ChangeEvent<HTMLInputElement>) => setValue(input.name, event.target.checked)} /><span />เปิดใช้งาน</label>;
    }
    if (input.type === "file") {
      const fileValue = value && typeof value === "object" && !Array.isArray(value) && "name" in value ? value as UploadedFileValue : undefined;
      return (
        <div className="runnerFile">
          <input type="file" accept={input.accept?.join(",")} onChange={(event: ChangeEvent<HTMLInputElement>) => void onFileChange(input, event)} required={input.required && !fileValue} />
          <span>{fileValue ? `${fileValue.name} · ${(fileValue.size / 1024).toFixed(1)} KB` : "รองรับไฟล์ไม่เกิน 5 MB"}</span>
        </div>
      );
    }
    if (input.type === "number") {
      return <input type="number" value={typeof value === "number" ? value : ""} onChange={(event: ChangeEvent<HTMLInputElement>) => setValue(input.name, event.target.value === "" ? null : Number(event.target.value))} placeholder={input.placeholder} required={input.required} />;
    }
    return <input type={input.type === "date" ? "date" : "text"} value={typeof value === "string" ? value : ""} onChange={(event: ChangeEvent<HTMLInputElement>) => setValue(input.name, event.target.value)} placeholder={input.placeholder} required={input.required} />;
  }

  return (
    <main className="runnerPage">
      <header className="runnerTopbar">
        <Link className="runnerBrand" href="/templates"><span>CF</span><div><strong>CherryFlow</strong><small>Template Runner</small></div></Link>
        <nav><Link href="/templates">Templates</Link><Link href={`/builder?workflow=${encodeURIComponent(workflowId)}`}>สร้าง App</Link><Link href="/dashboard">Control Center</Link></nav>
      </header>

      <section className="runnerHero">
        <div>
          <p>RUNNABLE WORKFLOW</p>
          <h1>{workflow?.name ?? "กำลังโหลด Workflow..."}</h1>
          <span>{workflow?.description}</span>
        </div>
        <div className={`runnerStatus status-${run?.status ?? "idle"}`}><i />{statusLabel(run?.status)}</div>
      </section>

      <section className="runnerWorkspace">
        <form className="runnerForm" onSubmit={submit}>
          <div className="runnerPanelHeading"><div><p>INPUTS</p><h2>ข้อมูลสำหรับเริ่มงาน</h2></div><span>{workflow?.inputs.length ?? 0} fields</span></div>
          <div className="runnerFields">
            {(workflow?.inputs ?? []).map((input) => (
              <label className={`runnerField field-${input.type}`} key={input.name}>
                <strong>{input.label}{input.required && <em>*</em>}</strong>
                {input.description && <small>{input.description}</small>}
                {renderInput(input)}
              </label>
            ))}
          </div>
          {error && <div className="runnerError">{error}</div>}
          <button className="runnerSubmit" type="submit" disabled={busy || !workflow}>{busy ? "กำลังทำงาน..." : "Run Workflow →"}</button>
          <p className="runnerSafety">AI จะสร้างร่างและ Checklist จากข้อมูลที่ให้ การอนุมัติและการนำไปใช้จริงยังต้องเป็นหน้าที่ของมนุษย์ เพราะโลกยังไม่ควรมอบปุ่มอนุมัติทุกอย่างให้โมเดลภาษา</p>
        </form>

        <section className="runnerResult">
          <div className="runnerPanelHeading"><div><p>OUTPUTS</p><h2>ผลลัพธ์</h2></div>{run && <span>{run.id.slice(0, 8)}</span>}</div>
          {!run && <div className="runnerEmpty"><span>▶</span><strong>กรอกข้อมูลแล้วเริ่ม Workflow</strong><p>Template จะใช้ Local Qwen เมื่อเชื่อม OpenAI-compatible endpoint หรือสร้างโครงผลลัพธ์แบบ deterministic เมื่อทำงาน Offline</p></div>}
          {run && run.status !== "completed" && run.status !== "failed" && (
            <div className="runnerProgress"><i /><strong>{statusLabel(run.status)}</strong><p>กำลังเรียก Module ตามลำดับของ Workflow Graph</p></div>
          )}
          {run?.status === "failed" && <div className="runnerError"><strong>Workflow failed</strong><p>{run.error}</p></div>}
          {completedOutputs && (
            <div className="runnerOutputs">
              {(workflow?.outputs ?? []).map((output) => (
                <article className={`runnerOutput output-${output.type}`} key={output.name}>
                  <h3>{output.label}</h3>
                  <RuntimeOutput value={completedOutputs[output.name]} />
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
