"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthGate } from "../../components/AuthGate";
import { requestJson } from "../../lib/client";
import "./dashboard.css";

type RuntimeStatus = {
  aiProvider: string;
  embeddingProvider: string;
  store: "json" | "postgres";
  runner: "in_process" | "redis";
  fileStorage: "inline" | "s3";
  memory: "disabled" | "pgvector";
};

type WorkflowOverview = {
  id: string;
  name: string;
  description: string;
  inputCount: number;
  outputCount: number;
  nodeCount: number;
  edgeCount: number;
  canvasUpdatedAt?: string;
  versions: number;
  publishedVersions: number;
};

type VersionOverview = {
  id: string;
  workflowId: string;
  status: "draft" | "published";
  createdAt: string;
};

type ModelOverview = {
  id: string;
  provider: string;
  displayName: string;
  capabilities: string[];
  status: "available" | "unavailable";
  contextWindow?: number;
  updatedAt: string;
};

type WorkerPool = {
  id: string;
  type: string;
  label: string;
  status: "online" | "degraded" | "offline";
  models: string[];
  concurrency: number;
  updatedAt: string;
};

type ModuleOverview = {
  type: string;
  label: string;
  description: string;
};

type OverviewPayload = {
  generatedAt: string;
  service: string;
  runtime: RuntimeStatus;
  totals: {
    workflows: number;
    modules: number;
    canvases: number;
    versions: number;
    publishedVersions: number;
    users: number;
    models: number;
    availableModels: number;
    workerPools: number;
    onlineWorkerPools: number;
  };
  workflows: WorkflowOverview[];
  recentVersions: VersionOverview[];
  models: ModelOverview[];
  workerPools: WorkerPool[];
  modules: ModuleOverview[];
};

const quickActions = [
  { href: "/builder", code: "AI", title: "AI App Builder", detail: "สร้าง UI Schema และ Publish application" },
  { href: "/canvas", code: "WF", title: "Workflow Canvas", detail: "ลาก node ต่อ graph ตรวจสอบและรัน Flow" },
  { href: "/process-builder", code: "BP", title: "Business Process", detail: "ออกแบบขั้นตอนงานและ Swimlane" },
  { href: "/models", code: "ML", title: "Model Registry", detail: "ตรวจ model endpoint และ worker pools" },
] as const;

function formatDate(value: string | undefined): string {
  if (!value) return "ยังไม่มีข้อมูล";
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function RuntimeCard({ code, label, value, detail }: { code: string; label: string; value: string; detail: string }) {
  return (
    <article className="runtimeCard">
      <span className="runtimeIcon">{code}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
      <span className="runtimeDot" aria-label="configured" />
    </article>
  );
}

function DashboardContent() {
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      setOverview(await requestJson<OverviewPayload>("/api/overview"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "โหลดภาพรวมระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
    const timer = window.setInterval(() => void loadOverview(true), 30_000);
    return () => window.clearInterval(timer);
  }, [loadOverview]);

  const runtimeCards = useMemo(() => {
    if (!overview) return [];
    return [
      { code: "AI", label: "AI Provider", value: overview.runtime.aiProvider, detail: "Planner และ inference route" },
      { code: "EM", label: "Embedding", value: overview.runtime.embeddingProvider, detail: "Vector generation provider" },
      { code: "DB", label: "State Store", value: overview.runtime.store, detail: overview.runtime.store === "postgres" ? "Durable PostgreSQL mode" : "Local JSON mode" },
      { code: "Q", label: "Run Queue", value: overview.runtime.runner, detail: overview.runtime.runner === "redis" ? "Distributed Redis queue" : "API process execution" },
      { code: "FS", label: "File Storage", value: overview.runtime.fileStorage, detail: overview.runtime.fileStorage === "s3" ? "S3 / MinIO object storage" : "Inline file payloads" },
      { code: "MEM", label: "AI Memory", value: overview.runtime.memory, detail: overview.runtime.memory === "pgvector" ? "PostgreSQL pgvector" : "Not configured" },
    ];
  }, [overview]);

  if (loading && !overview) {
    return (
      <main className="dashboardPage dashboardStatePage">
        <div className="dashboardStateCard">
          <span className="dashboardSpinner" />
          <h1>กำลังประกอบภาพรวม CherryFlow</h1>
          <p>อ่าน Workflow, Models, Worker Pools และ Runtime configuration จาก API จริง</p>
        </div>
      </main>
    );
  }

  if (!overview) {
    return (
      <main className="dashboardPage dashboardStatePage">
        <div className="dashboardStateCard errorState">
          <span className="stateCode">ERR</span>
          <h1>เปิด Control Center ไม่สำเร็จ</h1>
          <p>{error || "API ไม่ส่งข้อมูลกลับมา"}</p>
          <button type="button" onClick={() => void loadOverview()}>ลองเชื่อมต่อใหม่</button>
        </div>
      </main>
    );
  }

  const metrics = [
    { label: "Workflows", value: overview.totals.workflows, detail: `${overview.totals.canvases} canvases saved` },
    { label: "Modules", value: overview.totals.modules, detail: "Executable registry entries" },
    { label: "Versions", value: overview.totals.versions, detail: `${overview.totals.publishedVersions} published` },
    { label: "Models", value: overview.totals.models, detail: `${overview.totals.availableModels} available` },
    { label: "Worker Pools", value: overview.totals.workerPools, detail: `${overview.totals.onlineWorkerPools} online` },
    { label: "Users", value: overview.totals.users, detail: "RBAC accounts" },
  ];

  return (
    <main className="dashboardPage">
      <div className="dashboardBackdrop" aria-hidden="true" />
      <header className="dashboardHeader">
        <Link className="dashboardBrand" href="/">
          <span className="dashboardBrandMark">C</span>
          <span><strong>CherryFlow</strong><small>Operational Control Center</small></span>
        </Link>
        <nav className="dashboardNav" aria-label="CherryFlow navigation">
          <Link href="/builder">Builder</Link>
          <Link href="/canvas">Canvas</Link>
          <Link href="/process-builder">Process</Link>
          <Link href="/models">Models</Link>
        </nav>
        <button className="refreshButton" type="button" onClick={() => void loadOverview(true)} disabled={refreshing}>
          <span className={refreshing ? "refreshGlyph spinning" : "refreshGlyph"}>↻</span>
          {refreshing ? "กำลังอัปเดต" : "Refresh"}
        </button>
      </header>

      <section className="dashboardHero">
        <div>
          <span className="dashboardEyebrow"><i /> LIVE CONFIGURATION OVERVIEW</span>
          <h1>เห็นสถานะของแพลตฟอร์ม<br /><span>ในหน้าจอเดียว</span></h1>
          <p>รวม Workflow, module registry, application versions, Local AI, storage และ worker configuration จาก CherryFlow API โดยตรง</p>
          <div className="heroMeta">
            <span><b>API</b> {overview.service}</span>
            <span><b>Updated</b> {formatDate(overview.generatedAt)}</span>
            <span className="healthy"><i /> CONFIGURED</span>
          </div>
        </div>
        <div className="heroTopology" aria-label="CherryFlow runtime topology">
          <div className="topologyCore">
            <span>CF</span>
            <strong>CherryFlow API</strong>
            <small>Validated orchestration</small>
          </div>
          <div className="topologyNode nodeTop"><span>AI</span><small>{overview.runtime.aiProvider}</small></div>
          <div className="topologyNode nodeRight"><span>DB</span><small>{overview.runtime.store}</small></div>
          <div className="topologyNode nodeBottom"><span>Q</span><small>{overview.runtime.runner}</small></div>
          <div className="topologyNode nodeLeft"><span>FS</span><small>{overview.runtime.fileStorage}</small></div>
          <i className="orbit orbitOne" /><i className="orbit orbitTwo" />
        </div>
      </section>

      {error && <div className="dashboardNotice"><strong>Refresh ล่าสุดไม่สำเร็จ</strong><span>{error}</span></div>}

      <section className="metricGrid" aria-label="Platform totals">
        {metrics.map((metric) => (
          <article className="metricCard" key={metric.label}>
            <span className="metricValue">{metric.value}</span>
            <strong>{metric.label}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </section>

      <section className="dashboardSection">
        <div className="sectionHeading">
          <div><span>Runtime</span><h2>Infrastructure configuration</h2></div>
          <p>แสดงโหมดที่ตั้งค่าอยู่ โดยแยกข้อมูล configuration ออกจากการตรวจสอบ connectivity ของบริการภายนอก</p>
        </div>
        <div className="runtimeGrid">
          {runtimeCards.map((card) => <RuntimeCard key={card.label} {...card} />)}
        </div>
      </section>

      <section className="dashboardSection">
        <div className="sectionHeading">
          <div><span>Workflows</span><h2>Executable workflow inventory</h2></div>
          <Link className="sectionLink" href="/canvas">เปิด Visual Canvas →</Link>
        </div>
        <div className="workflowCards">
          {overview.workflows.map((workflow) => (
            <article className="workflowCard" key={workflow.id}>
              <div className="workflowCardTop">
                <span className="workflowMark">WF</span>
                <div><p>{workflow.id}</p><h3>{workflow.name}</h3></div>
                <span className="workflowStatus"><i /> READY</span>
              </div>
              <p className="workflowDescription">{workflow.description}</p>
              <div className="workflowStats">
                <span><b>{workflow.nodeCount}</b> nodes</span>
                <span><b>{workflow.edgeCount}</b> edges</span>
                <span><b>{workflow.inputCount}</b> inputs</span>
                <span><b>{workflow.outputCount}</b> outputs</span>
              </div>
              <div className="workflowVersionRow">
                <span>{workflow.versions} versions · {workflow.publishedVersions} published</span>
                <small>Canvas: {formatDate(workflow.canvasUpdatedAt)}</small>
              </div>
              <div className="workflowActions">
                <Link href="/builder">Generate App</Link>
                <Link href="/canvas">Edit Flow</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboardSplit">
        <article className="dashboardPanel">
          <div className="panelHeading"><div><span>Deployments</span><h2>Recent application versions</h2></div><b>{overview.recentVersions.length}</b></div>
          {overview.recentVersions.length === 0 ? (
            <div className="emptyPanel"><span>V0</span><strong>ยังไม่มี App Version</strong><p>สร้าง UI ใน Builder แล้ว Save หรือ Publish เพื่อให้ประวัติแสดงที่นี่</p><Link href="/builder">เปิด Builder</Link></div>
          ) : (
            <div className="versionList">
              {overview.recentVersions.map((version) => (
                <div className="versionRow" key={version.id}>
                  <span className={`versionStatus ${version.status}`}>{version.status}</span>
                  <div><strong>{version.workflowId}</strong><small>{version.id.slice(0, 12)}…</small></div>
                  <time>{formatDate(version.createdAt)}</time>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="dashboardPanel">
          <div className="panelHeading"><div><span>AI Runtime</span><h2>Models and worker pools</h2></div><Link href="/models">Manage →</Link></div>
          {overview.models.length === 0 && overview.workerPools.length === 0 ? (
            <div className="emptyPanel"><span>M0</span><strong>Registry ยังว่าง</strong><p>เปิดหน้า Models แล้ว Sync จาก OpenAI-compatible endpoint</p><Link href="/models">Sync Models</Link></div>
          ) : (
            <div className="registryCompact">
              {overview.models.slice(0, 5).map((model) => (
                <div className="registryRow" key={model.id}>
                  <span className="registryIcon">AI</span>
                  <div><strong>{model.displayName}</strong><small>{model.provider} · {model.capabilities.join(", ") || "general"}</small></div>
                  <span className={`registryStatus ${model.status}`}>{model.status}</span>
                </div>
              ))}
              {overview.workerPools.slice(0, 4).map((pool) => (
                <div className="registryRow" key={pool.id}>
                  <span className="registryIcon">GPU</span>
                  <div><strong>{pool.label}</strong><small>{pool.type} · concurrency {pool.concurrency} · {pool.models.length} models</small></div>
                  <span className={`registryStatus ${pool.status}`}>{pool.status}</span>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="dashboardSection">
        <div className="sectionHeading"><div><span>Workspace</span><h2>Build and operate</h2></div><p>ทางลัดไปยังเครื่องมือหลักสำหรับสร้าง ตรวจสอบ และดูแล Workflow</p></div>
        <div className="quickActionGrid">
          {quickActions.map((action) => (
            <Link className="quickAction" href={action.href} key={action.href}>
              <span>{action.code}</span><div><strong>{action.title}</strong><small>{action.detail}</small></div><b>→</b>
            </Link>
          ))}
        </div>
      </section>

      <footer className="dashboardFooter">
        <div><span className="dashboardBrandMark small">C</span><p><strong>CherryFlow</strong><small>Local AI Workflow Platform</small></p></div>
        <p>Configuration overview refreshes every 30 seconds.</p>
      </footer>
    </main>
  );
}

export default function DashboardPage() {
  return <AuthGate><DashboardContent /></AuthGate>;
}
