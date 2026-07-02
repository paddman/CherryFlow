"use client";

import { useState } from "react";

type GeneratedResult = {
  schema?: unknown;
  validation?: { valid: boolean; errors: string[] };
  error?: string;
};

const apiUrl = process.env.NEXT_PUBLIC_CHERRYFLOW_API_URL ?? "http://localhost:4000";

export default function HomePage() {
  const [prompt, setPrompt] = useState(
    "สร้างหน้ารับไฟล์ Excel มีช่องชื่อโครงการ แสดงสถานะ และดาวน์โหลดรายงาน PDF",
  );
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function generateApp() {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`${apiUrl}/api/workflows/report-generator/ui/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      setResult((await response.json()) as GeneratedResult);
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="shell">
        <p className="eyebrow">CHERRYFLOW · AI APP BUILDER</p>
        <h1>เปลี่ยน Workflow ให้เป็นหน้าเว็บพร้อมใช้</h1>
        <p className="lead">
          อธิบายหน้าที่ต้องการ แล้ว CherryFlow จะสร้าง UI Schema ที่เชื่อมกับ Input และ Output ของ Flow
        </p>

        <label htmlFor="prompt">คำสั่งสร้างหน้า</label>
        <textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        <button type="button" onClick={generateApp} disabled={loading || prompt.trim().length === 0}>
          {loading ? "กำลังสร้าง..." : "Generate App"}
        </button>

        {result && (
          <section className="result">
            <div className="resultHeader">
              <h2>Generated UI Schema</h2>
              {result.validation && (
                <span data-valid={result.validation.valid}>
                  {result.validation.valid ? "Validated" : "Invalid"}
                </span>
              )}
            </div>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </section>
        )}
      </section>
    </main>
  );
}
