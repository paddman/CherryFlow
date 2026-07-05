"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "../../components/AuthGate";
import { requestJson } from "../../lib/client";
import "./models.css";

type ModelStatus = "available" | "unavailable";
type PoolStatus = "online" | "degraded" | "offline";

interface ModelEntry {
  id: string;
  provider: string;
  displayName: string;
  endpoint?: string;
  capabilities: string[];
  status: ModelStatus;
  contextWindow?: number;
  updatedAt: string;
}

interface WorkerPool {
  id: string;
  type: string;
  label: string;
  endpoint?: string;
  status: PoolStatus;
  models: string[];
  concurrency: number;
  updatedAt: string;
}

interface RegistryPayload {
  models: ModelEntry[];
  workerPools: WorkerPool[];
}

function RegistryPage() {
  const [payload, setPayload] = useState<RegistryPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const featured = useMemo(() => payload?.models.filter((model) => model.id.includes("qwen/qwen3.5-9b") || model.id.includes("qwen3.5-9b")).slice(0, 3) ?? [], [payload]);

  async function load() {
    setPayload(await requestJson<RegistryPayload>("/api/models"));
  }

  async function sync() {
    setBusy(true);
    setNotice("");
    try {
      const result = await requestJson<RegistryPayload & { synced?: boolean }>("/api/models/sync", { method: "POST" });
      setPayload(result);
      setNotice(`Sync สำเร็จ · ${result.models.length} models · ${result.workerPools.length} pools`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Sync ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load().catch((error: unknown) => setNotice(error instanceof Error ? error.message : "โหลด model registry ไม่สำเร็จ"));
  }, []);

  return (
    <main className="modelsPage">
      <header className="modelsHero">
        <p className="eyebrow">Phase 4</p>
        <h1>ML/DL Worker Pools & Model Registry</h1>
        <p>ติดตาม model endpoint, GPU worker pool, capability tags และสถานะ sync จาก OpenAI-compatible server.</p>
        <button className="primaryButton" type="button" onClick={sync} disabled={busy}>{busy ? "กำลัง Sync..." : "Sync Models"}</button>
        {notice && <p className="modelsNotice">{notice}</p>}
      </header>

      <section className="modelsGrid">
        <article className="modelsCard">
          <span className="modelsNumber">{payload?.models.length ?? 0}</span>
          <strong>Registered Models</strong>
          <p>Models จาก `/v1/models` ถูกบันทึกลง registry</p>
        </article>
        <article className="modelsCard">
          <span className="modelsNumber">{payload?.workerPools.length ?? 0}</span>
          <strong>Worker Pools</strong>
          <p>Pool metadata สำหรับ ML/DL orchestration</p>
        </article>
        <article className="modelsCard">
          <span className="modelsNumber">{featured.length}</span>
          <strong>Qwen Matches</strong>
          <p>รุ่นหลักที่ CherryFlow ใช้อยู่ถูกจับใน registry</p>
        </article>
      </section>

      <section className="registrySection">
        <h2>Worker Pools</h2>
        <div className="registryList">
          {(payload?.workerPools ?? []).map((pool) => (
            <article className="registryRow" key={pool.id}>
              <div>
                <strong>{pool.label}</strong>
                <code>{pool.id}</code>
                <p>{pool.endpoint ?? "no endpoint"} · concurrency {pool.concurrency} · {pool.models.length} models</p>
              </div>
              <span className={`poolStatus ${pool.status}`}>{pool.status}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="registrySection">
        <h2>Models</h2>
        <div className="modelTable">
          {(payload?.models ?? []).map((model) => (
            <article className="modelRow" key={model.id}>
              <div>
                <strong>{model.displayName}</strong>
                <p>{model.provider} · {new Date(model.updatedAt).toLocaleString("th-TH")}</p>
              </div>
              <div className="capabilities">{model.capabilities.map((capability) => <span key={capability}>{capability}</span>)}</div>
              <span className={`modelStatus ${model.status}`}>{model.status}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default function ModelsPage() {
  return <AuthGate><RegistryPage /></AuthGate>;
}
