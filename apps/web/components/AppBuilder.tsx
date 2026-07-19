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
type BuilderTab = "preview" | "flow" | "schema" | "versions";

const tabs: Array<{ id: BuilderTab; label: string; hint: string }> = [
  { id: "preview", label: "Preview", hint: "Runtime app" },
  { id: "flow", label: "Flow", hint: "Execution graph" },
  { id: "schema", label: "Schema", hint: "Safe UI JSON" },
  { id: "versions", label: "Versions", hint: "History" },
];

const jsonPost = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

function formatVersionDate(value: string) {
  return new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

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
  const [tab, setTab] = useState<BuilderTab>("preview");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const publicUrl = useMemo(
    () => typeof window === "undefined"
      ? `/apps/${sanitizeSlug(slug)}`
      : `${window.location.origin}/apps/${sanitizeSlug(slug)}`,
    [slug],
  );

  const schemaComponentCount = schema?.page.components.length ?? 0;
  const graphNodeCount = graph?.graph.nodes.length ?? 0;
  const publishedVersion = versions.find((version) => version.status === "published");

  async function refreshVersions() {
    const result = await requestJson<{ versions: Version[] }>(`/api/workflows/${workflowId}/ui/versions`);
    setVersions(result.versions);
  }

  useEffect(() => {
    requestJson<WorkflowContract>(`/api/workflows/${workflowId}`)
      .then(setWorkflow)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Load failed"));
    requestJson<GraphResponse>(`/api/workflows/${workflowId}/graph`).then(setGraph).catch(() => undefined);
    refreshVersions().catch(() => undefined);
  }, [workflowId]);

  useEffect(() => {
    const stored = window.localStorage.getItem("cherryflow-builder-theme");
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setDarkMode(stored ? stored === "dark" : Boolean(prefersDark));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("cherryflow-builder-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
      if (event.key === "Escape") setCommandOpen(false);
      if ((event.ctrlKey || event.metaKey) && ["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        setTab(tabs[Number(event.key) - 1]?.id ?? "preview");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function action(name: string, task: () => Promise<void>) {
    setBusy(name);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action failed");
    } finally {
      setBusy("");
    }
  }

  function usePlan(result: Plan) {
    setSchema(result.schema);
    setProvider(result.provider);
    setValidation(result.validation);
    setSlug(sanitizeSlug(result.schema.meta.name));
    setTab("preview");
    setNotice(result.fallbackReason ? `ใช้ local fallback: ${result.fallbackReason}` : "สร้างเว็บไซต์เรียบร้อยแล้ว");
  }

  const generate = () => action(
    "generate",
    async () => usePlan(await requestJson<Plan>(`/api/workflows/${workflowId}/ui/generate`, jsonPost({ prompt }))),
  );

  const refine = () => schema && action("refine", async () => {
    usePlan(await requestJson<Plan>(`/api/workflows/${workflowId}/ui/refine`, jsonPost({ prompt: refinePrompt, schema })));
    setRefinePrompt("");
  });

  const save = () => schema && action("save", async () => {
    await requestJson(`/api/workflows/${workflowId}/ui/save`, jsonPost({ schema, prompt }));
    await refreshVersions();
    setNotice("บันทึก Draft แล้ว");
  });

  const publish = () => schema && action("publish", async () => {
    await requestJson(`/api/workflows/${workflowId}/ui/publish`, jsonPost({ schema, prompt, slug }));
    await refreshVersions();
    setNotice(`เผยแพร่แล้ว: ${publicUrl}`);
  });

  const rollback = (versionId: string) => action("rollback", async () => {
    const result = await requestJson<{ version: Version }>(
      `/api/workflows/${workflowId}/ui/rollback`,
      jsonPost({ versionId }),
    );
    setSchema(result.version.schema);
    setPrompt(result.version.prompt);
    await refreshVersions();
    setTab("preview");
    setNotice("เรียกคืน Version เป็น Draft แล้ว");
  });

  const commandItems: Array<{ label: string; detail: string; action: () => void; disabled?: boolean }> = [
    { label: "Generate website", detail: "สร้าง UI schema จาก prompt", action: generate, disabled: busy !== "" },
    { label: "Open editable canvas", detail: "แก้ workflow graph แบบ drag-and-drop", action: () => { window.location.href = "/canvas"; } },
    { label: "Validate schema", detail: validation?.valid ? "Schema ผ่าน validation" : "เปิดดู validation issues", action: () => setTab("schema"), disabled: !schema },
    { label: "Save draft", detail: "บันทึก schema ปัจจุบัน", action: save, disabled: !schema || busy !== "" },
    { label: "Publish app", detail: sanitizeSlug(slug), action: publish, disabled: !schema || busy !== "" || validation?.valid === false },
  ];

  return (
    <main className="builderShell" data-theme={darkMode ? "dark" : "light"}>
      <aside className="builderPanel" aria-label="Builder controls">
        <div className="brandRow">
          <span className="brandMark" aria-hidden="true">CF</span>
          <div>
            <strong>CherryFlow</strong>
            <small>Local AI operations cockpit</small>
          </div>
        </div>

        <nav className="builderQuickNav" aria-label="CherryFlow navigation">
          <a href="/">Overview</a>
          <a href="/canvas">Canvas</a>
          <a href="/models">Models</a>
          <button type="button" onClick={() => setCommandOpen(true)}>Commands <kbd>⌘K</kbd></button>
        </nav>

        <section className="workflowSummary">
          <div className="summaryHeading">
            <p className="sectionLabel">WORKFLOW</p>
            <span className="statusDot" data-status={validation?.valid ? "healthy" : schema ? "warning" : "idle"} />
          </div>
          <h1>{workflow?.name ?? "กำลังโหลด..."}</h1>
          <p className="panelLead">{workflow?.description}</p>
          <div className="summaryStats" aria-label="Workflow summary">
            <span><strong>{graphNodeCount}</strong> nodes</span>
            <span><strong>{schemaComponentCount}</strong> sections</span>
            <span><strong>{versions.length}</strong> versions</span>
          </div>
        </section>

        <section className="builderControlSection">
          <div className="controlSectionHeader">
            <div>
              <p className="sectionLabel">01 · GENERATE</p>
              <h2>Describe the app</h2>
            </div>
            <span className="stepState">{schema ? "Ready" : "Start"}</span>
          </div>
          <label className="controlLabel" htmlFor="prompt">Prompt</label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setPrompt(event.target.value)}
            placeholder="อธิบาย workflow app, กลุ่มผู้ใช้, ข้อมูล และผลลัพธ์"
          />
          <div className="fieldMeta">
            <span>{prompt.trim().length} characters</span>
            <span>Safe schema only</span>
          </div>
          <button type="button" className="primaryButton wide" onClick={generate} disabled={busy !== "" || !prompt.trim()}>
            {busy === "generate" ? "กำลังสร้าง..." : schema ? "Generate again" : "Generate website"}
          </button>
        </section>

        {schema && (
          <>
            <section className="builderControlSection">
              <div className="controlSectionHeader">
                <div>
                  <p className="sectionLabel">02 · REFINE</p>
                  <h2>Improve with AI</h2>
                </div>
                <span className="stepState">Optional</span>
              </div>
              <label className="controlLabel" htmlFor="refine">Change request</label>
              <textarea
                id="refine"
                className="smallTextarea"
                placeholder="เช่น เพิ่ม KPI cards, ทำ compact, ปรับภาษาให้เป็นทางการ"
                value={refinePrompt}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setRefinePrompt(event.target.value)}
              />
              <button
                type="button"
                className="secondaryButton wide"
                onClick={refine}
                disabled={!refinePrompt.trim() || busy !== ""}
              >
                {busy === "refine" ? "กำลังปรับ..." : "Refine current draft"}
              </button>
            </section>

            <section className="publishBox">
              <div className="controlSectionHeader">
                <div>
                  <p className="sectionLabel">03 · RELEASE</p>
                  <h2>Save and publish</h2>
                </div>
                {publishedVersion && <span className="stepState published">Published</span>}
              </div>
              <label className="controlLabel" htmlFor="slug">Public slug</label>
              <div className="slugField">
                <span>/apps/</span>
                <input
                  id="slug"
                  value={slug}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setSlug(sanitizeSlug(event.target.value))}
                />
              </div>
              <div className="buttonRow">
                <button type="button" className="secondaryButton" onClick={save} disabled={busy !== ""}>
                  {busy === "save" ? "Saving..." : "Save draft"}
                </button>
                <button
                  type="button"
                  className="primaryButton"
                  onClick={publish}
                  disabled={busy !== "" || validation?.valid === false}
                >
                  {busy === "publish" ? "Publishing..." : "Publish"}
                </button>
              </div>
              <a className="publicLink" href={`/apps/${sanitizeSlug(slug)}`} target="_blank" rel="noreferrer">
                <span>Open public app</span>
                <small>{publicUrl}</small>
              </a>
            </section>
          </>
        )}

        <div className="sidebarFooter">
          <span>Local-first · Validated execution</span>
          <button
            type="button"
            className="iconButton"
            aria-label={darkMode ? "Use light theme" : "Use dark theme"}
            onClick={() => setDarkMode((current) => !current)}
          >
            {darkMode ? "Light" : "Dark"}
          </button>
        </div>

        <div className="srLive" aria-live="polite">{notice || error || busy}</div>
      </aside>

      <section className="workspace">
        <header className="workspaceHeader">
          <div className="workspaceContext">
            <div className="breadcrumb" aria-label="Breadcrumb">
              <span>Workflows</span><b>/</b><strong>{workflow?.name ?? workflowId}</strong>
            </div>
            <div className="workspaceTitleRow">
              <h2>{schema?.meta.name ?? "App Builder"}</h2>
              <span className={validation?.valid ? "healthBadge healthy" : schema ? "healthBadge warning" : "healthBadge idle"}>
                {validation?.valid ? "Schema valid" : schema ? "Needs attention" : "No draft"}
              </span>
            </div>
          </div>
          <div className="workspaceActions">
            {provider && <span className="providerBadge"><i />{provider}</span>}
            <button type="button" className="headerButton" onClick={() => setCommandOpen(true)}>
              Search actions <kbd>⌘K</kbd>
            </button>
            <a className="headerButton primary" href="/canvas">Open canvas</a>
          </div>
        </header>

        <div className="workspaceTabBar">
          <div className="tabs" role="tablist" aria-label="Builder views">
            {tabs.map((item, index) => (
              <button
                key={item.id}
                id={`builder-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                aria-controls={`builder-panel-${item.id}`}
                tabIndex={tab === item.id ? 0 : -1}
                className={tab === item.id ? "tab active" : "tab"}
                onClick={() => setTab(item.id)}
              >
                <span>{item.label}</span>
                <small>{item.hint}</small>
                {item.id === "versions" && versions.length > 0 && <b>{versions.length}</b>}
                {item.id === "schema" && validation?.valid === false && <b className="issueCount">{validation.errors.length}</b>}
                <kbd>⌘{index + 1}</kbd>
              </button>
            ))}
          </div>
          <div className="providerMeta">
            <span>{schemaComponentCount} components</span>
            <span>{graphNodeCount} nodes</span>
            <span className={validation?.valid ? "valid" : validation ? "invalid" : ""}>
              {validation?.valid ? "Validated" : validation ? `${validation.errors.length} issues` : "Not generated"}
            </span>
          </div>
        </div>

        {(notice || error) && (
          <div className={error ? "workspaceBanner error" : "workspaceBanner"} role={error ? "alert" : "status"}>
            <div>
              <strong>{error ? "Action failed" : "Update"}</strong>
              <span>{error || notice}</span>
            </div>
            <button type="button" aria-label="Dismiss message" onClick={() => { setError(""); setNotice(""); }}>×</button>
          </div>
        )}

        <div className="workspaceBody">
          <section
            id={`builder-panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`builder-tab-${tab}`}
            className="tabPanel"
          >
            {!schema && tab === "preview" && (
              <section className="builderEmpty">
                <div className="emptyIcon" aria-hidden="true">✦</div>
                <p className="sectionLabel">READY FOR LOCAL AI</p>
                <h2>สร้าง workflow app จาก prompt เดียว</h2>
                <p>CherryFlow จะสร้างเฉพาะ UI schema ที่ผ่าน allowlist และเชื่อมกับ workflow contract เดิม</p>
                <div className="emptyChecklist">
                  <span>Safe components</span>
                  <span>Preview immediately</span>
                  <span>Version and publish</span>
                </div>
                <button type="button" className="primaryButton" onClick={() => document.getElementById("prompt")?.focus()}>
                  Start with a prompt
                </button>
              </section>
            )}

            {schema && tab === "preview" && workflow && (
              <div className="previewWorkspace">
                <div className="previewToolbar">
                  <div>
                    <span className="windowDot red" /><span className="windowDot amber" /><span className="windowDot green" />
                  </div>
                  <strong>{publicUrl}</strong>
                  <a href={`/apps/${sanitizeSlug(slug)}`} target="_blank" rel="noreferrer">Open ↗</a>
                </div>
                <div className="previewFrame">
                  <SchemaRenderer schema={schema} workflow={workflow} runPath={`/api/workflows/${workflowId}/runs`} />
                </div>
              </div>
            )}

            {tab === "flow" && (
              <WorkflowGraphPanel graph={graph?.graph ?? null} validation={graph?.validation ?? null} />
            )}

            {tab === "schema" && (
              <div className="schemaWorkspace">
                <aside className="validationPanel">
                  <div className="validationHeader">
                    <span className={validation?.valid ? "validationIcon valid" : "validationIcon invalid"}>
                      {validation?.valid ? "✓" : "!"}
                    </span>
                    <div>
                      <p className="sectionLabel">VALIDATION</p>
                      <h2>{validation?.valid ? "Schema is ready" : schema ? "Review issues" : "No schema yet"}</h2>
                    </div>
                  </div>
                  <p className="muted">
                    AI cannot inject arbitrary HTML or JavaScript. Every component is validated against CherryFlow&apos;s allowlist.
                  </p>
                  {validation?.errors.length ? (
                    <ol className="validationIssues">
                      {validation.errors.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                    </ol>
                  ) : (
                    <div className="validationSuccess">
                      <strong>All checks passed</strong>
                      <span>{schemaComponentCount} safe components are ready to render.</span>
                    </div>
                  )}
                  <dl className="schemaFacts">
                    <div><dt>Version</dt><dd>{schema?.version ?? "—"}</dd></div>
                    <div><dt>Layout</dt><dd>{schema?.page.layout ?? "—"}</dd></div>
                    <div><dt>Density</dt><dd>{schema?.theme.density ?? "—"}</dd></div>
                    <div><dt>Radius</dt><dd>{schema?.theme.radius ?? "—"}</dd></div>
                  </dl>
                </aside>
                <section className="schemaPanel" aria-label="UI schema JSON">
                  <div className="codeHeader">
                    <span>ui-schema.json</span>
                    <small>Read-only generated contract</small>
                  </div>
                  <pre>{schema ? JSON.stringify(schema, null, 2) : "Generate an app to inspect its schema."}</pre>
                </section>
              </div>
            )}

            {tab === "versions" && (
              <section className="versionsPanel">
                <div className="listHeader">
                  <div>
                    <p className="sectionLabel">VERSION CONTROL</p>
                    <h2>Draft and release history</h2>
                    <p>Restore any prior UI schema without changing the workflow contract.</p>
                  </div>
                  <button type="button" className="secondaryButton" onClick={() => refreshVersions()} disabled={busy !== ""}>Refresh</button>
                </div>
                {versions.length === 0 && (
                  <div className="listEmpty">
                    <strong>No versions yet</strong>
                    <span>Save the generated draft to start version history.</span>
                  </div>
                )}
                <div className="versionList">
                  {versions.map((version, index) => (
                    <article className="versionRow" key={version.id}>
                      <div className="versionIndex">{String(versions.length - index).padStart(2, "0")}</div>
                      <div className="versionInfo">
                        <div>
                          <strong>{version.schema.meta.name}</strong>
                          <span className={`versionStatus ${version.status}`}>{version.status}</span>
                        </div>
                        <p>{formatVersionDate(version.createdAt)} · {version.schema.page.components.length} components</p>
                      </div>
                      <button
                        type="button"
                        className="secondaryButton"
                        onClick={() => rollback(version.id)}
                        disabled={busy !== ""}
                      >
                        Restore as draft
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </section>
        </div>
      </section>

      {commandOpen && (
        <div className="commandOverlay" role="presentation" onMouseDown={() => setCommandOpen(false)}>
          <section
            className="commandDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="command-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="commandSearch">
              <span aria-hidden="true">⌘</span>
              <div>
                <strong id="command-title">Quick actions</strong>
                <small>Navigate, validate and release without leaving the builder</small>
              </div>
              <kbd>ESC</kbd>
            </div>
            <div className="commandList">
              {commandItems.map((item) => (
                <button
                  type="button"
                  key={item.label}
                  disabled={item.disabled}
                  onClick={() => {
                    item.action();
                    setCommandOpen(false);
                  }}
                >
                  <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                  <b>↵</b>
                </button>
              ))}
            </div>
            <footer>
              <span><kbd>⌘1–4</kbd> switch views</span>
              <span><kbd>⌘K</kbd> toggle commands</span>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
