"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import type { UiSchema, UiValidationResult, WorkflowContract } from "@cherryflow/ui-schema";
import { sanitizeSlug } from "@cherryflow/ui-schema";
import { requestJson } from "../lib/client";
import { SchemaRenderer } from "./SchemaRenderer";
import { WorkflowGraphPanel, type WorkflowGraph } from "./WorkflowGraphPanel";

type Version = { id: string; schema: UiSchema; prompt: string; createdAt: string; status: "draft" | "published" };
type Plan = { schema: UiSchema; provider: string; fallbackReason?: string; validation: UiValidationResult };
type GraphResponse = { graph: WorkflowGraph; validation: { valid: boolean; errors: string[]; order: string[] } };
const jsonPost = (body: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export function AppBuilder({ workflowId }: { workflowId: string }) {
  const [workflow, setWorkflow] = useState<WorkflowContract | null>(null);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [schema, setSchema] = useState<UiSchema | null>(null);
  const [prompt, setPrompt] = useState("สร้างเว็บไซต์สำหรับระบบรายงาน ธีมราชการสีน้ำเงิน มีจุดเด่น ขั้นตอน แบบฟอร์ม สถานะ ผลลัพธ์ และคำถามที่พบบ่อย");
  const [refinePrompt, setRefinePrompt] = useState("");
  const [slug, setSlug] = useState("sales-report-app");
  const [versions, setVersions] = useState<Version[]>([]);
  const [provider, setProvider] = useState("");
  const [validation, setValidation] = useState<UiValidationResult | null>(null);
  const [tab, setTab] = useState<"preview" | "flow" | "schema" | "versions">("preview");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const publicUrl = useMemo(() => typeof window === "undefined" ? `/apps/${sanitizeSlug(slug)}` : `${window.location.origin}/apps/${sanitizeSlug(slug)}`, [slug]);

  async function refreshVersions() {
    const result = await requestJson<{ versions: Version[] }>(`/api/workflows/${workflowId}/ui/versions`);
    setVersions(result.versions);
  }

  useEffect(() => {
    requestJson<WorkflowContract>(`/api/workflows/${workflowId}`).then(setWorkflow).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Load failed"));
    requestJson<GraphResponse>(`/api/workflows/${workflowId}/graph`).then(setGraph).catch(() => undefined);
    refreshVersions().catch(() => undefined);
  }, [workflowId]);

  async function action(name: string, task: () => Promise<void>) {
    setBusy(name); setError(""); setNotice("");
    try { await task(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Action failed"); }
    finally { setBusy(""); }
  }

  function usePlan(result: Plan) {
    setSchema(result.schema);
    setProvider(result.provider);
    setValidation(result.validation);
    setSlug(sanitizeSlug(result.schema.meta.name));
    setTab("preview");
    setNotice(result.fallbackReason ? `ใช้ local fallback: ${result.fallbackReason}` : "สร้างเว็บไซต์เรียบร้อยแล้ว");
  }

  const generate = () => action("generate", async () => usePlan(await requestJson<Plan>(`/api/workflows/${workflowId}/ui/generate`, jsonPost({ prompt }))));
  const refine = () => schema && action("refine", async () => { usePlan(await requestJson<Plan>(`/api/workflows/${workflowId}/ui/refine`, jsonPost({ prompt: refinePrompt, schema }))); setRefinePrompt(""); });
  const save = () => schema && action("save", async () => { await requestJson(`/api/workflows/${workflowId}/ui/save`, jsonPost({ schema, prompt })); await refreshVersions(); setNotice("บันทึก Draft แล้ว"); });
  const publish = () => schema && action("publish", async () => { await requestJson(`/api/workflows/${workflowId}/ui/publish`, jsonPost({ schema, prompt, slug })); await refreshVersions(); setNotice(`เผยแพร่แล้ว: ${publicUrl}`); });
  const rollback = (versionId: string) => action("rollback", async () => { const result = await requestJson<{ version: Version }>(`/api/workflows/${workflowId}/ui/rollback`, jsonPost({ versionId })); setSchema(result.version.schema); setPrompt(result.version.prompt); await refreshVersions(); setTab("preview"); });

  return (
    <main className="builderShell">
      <aside className="builderPanel">
        <div className="brandRow"><span className="brandMark">C</span><div><strong>CherryFlow</strong><small>AI Website & Workflow Builder</small></div></div>
        <section><p className="sectionLabel">WORKFLOW</p><h1>{workflow?.name ?? "กำลังโหลด..."}</h1><p className="panelLead">{workflow?.description}</p></section>
        <section><label className="controlLabel" htmlFor="prompt">อธิบายเว็บไซต์หรือแอปที่ต้องการ</label><textarea id="prompt" value={prompt} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setPrompt(event.target.value)} /><button className="primaryButton wide" onClick={generate} disabled={busy !== ""}>{busy === "generate" ? "กำลังสร้าง..." : "Generate Website"}</button></section>

        {schema && <>
          <section><label className="controlLabel" htmlFor="refine">แก้เว็บไซต์ด้วย AI</label><textarea id="refine" className="smallTextarea" placeholder="เปลี่ยนสี เพิ่มส่วน FAQ ทำให้มินิมอล" value={refinePrompt} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setRefinePrompt(event.target.value)} /><button className="secondaryButton wide" onClick={refine} disabled={!refinePrompt.trim() || busy !== ""}>Refine</button></section>
          <section className="publishBox"><label className="controlLabel" htmlFor="slug">Public Slug</label><input id="slug" value={slug} onChange={(event: ChangeEvent<HTMLInputElement>) => setSlug(sanitizeSlug(event.target.value))} /><div className="buttonRow"><button className="secondaryButton" onClick={save}>Save</button><button className="primaryButton" onClick={publish}>Publish</button></div><a className="publicLink" href={`/apps/${sanitizeSlug(slug)}`} target="_blank" rel="noreferrer">{publicUrl}</a></section>
        </>}
        {(notice || error) && <p className={error ? "panelMessage error" : "panelMessage"}>{error || notice}</p>}
      </aside>

      <section className="workspace">
        <header className="workspaceHeader"><div className="tabs">{(["preview", "flow", "schema", "versions"] as const).map((item) => <button key={item} className={tab === item ? "tab active" : "tab"} onClick={() => setTab(item)}>{item}</button>)}</div><div className="providerMeta">{provider && <span>Provider: {provider}</span>}{validation && <span className={validation.valid ? "valid" : "invalid"}>{validation.valid ? "Validated" : "Invalid"}</span>}</div></header>
        <div className="workspaceBody">
          {!schema && tab === "preview" && <section className="builderEmpty"><div className="emptyIcon">✦</div><h2>พร้อมสร้างเว็บไซต์จาก Workflow</h2><p>ใส่ Prompt แล้วกด Generate Website</p></section>}
          {schema && tab === "preview" && workflow && <div className="previewFrame"><SchemaRenderer schema={schema} workflow={workflow} runPath={`/api/workflows/${workflowId}/runs`} /></div>}
          {tab === "flow" && <WorkflowGraphPanel graph={graph?.graph ?? null} validation={graph?.validation ?? null} />}
          {schema && tab === "schema" && <section className="schemaPanel"><pre>{JSON.stringify(schema, null, 2)}</pre></section>}
          {tab === "versions" && <section className="versionsPanel"><h2>Version History</h2>{versions.length === 0 && <p className="muted">ยังไม่มี Version</p>}{versions.map((version) => <article className="versionRow" key={version.id}><div><strong>{version.schema.meta.name}</strong><p>{new Date(version.createdAt).toLocaleString("th-TH")} · {version.status}</p></div><button className="secondaryButton" onClick={() => rollback(version.id)}>Restore as Draft</button></article>)}</section>}
        </div>
      </section>
    </main>
  );
}
