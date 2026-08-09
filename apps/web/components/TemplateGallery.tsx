"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { requestJson } from "../lib/client";

type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  tags: string[];
  featured: boolean;
  estimatedMinutes: number;
  requiresFile: boolean;
  starterPrompt: string;
  inputCount: number;
  outputCount: number;
};

type TemplatePayload = {
  templates: WorkflowTemplate[];
  total: number;
  featured: number;
  categories: string[];
};

const categoryLabels: Record<string, string> = {
  documents: "เอกสารและรายงาน",
  "sales-marketing": "ฝ่ายขายและการตลาด",
  hr: "ทรัพยากรบุคคล",
  "customer-service": "บริการลูกค้า",
  "it-security": "IT และความปลอดภัย",
  "finance-data-project": "การเงิน ข้อมูล และโครงการ",
  integrations: "Integrations และ ChatOps",
};

function categoryLabel(value: string): string {
  return categoryLabels[value] ?? value;
}

export function TemplateGallery() {
  const [payload, setPayload] = useState<TemplatePayload | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    requestJson<TemplatePayload>("/api/templates")
      .then(setPayload)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "โหลด Template ไม่สำเร็จ"));
  }, []);

  const templates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th-TH");
    return (payload?.templates ?? []).filter((template) => {
      if (category !== "all" && template.category !== category) return false;
      if (!normalized) return true;
      return [template.name, template.description, template.category, ...template.tags]
        .join(" ")
        .toLocaleLowerCase("th-TH")
        .includes(normalized);
    });
  }, [category, payload?.templates, query]);

  return (
    <main className="templatePage">
      <header className="templateTopbar">
        <Link className="templateBrand" href="/">
          <span>CF</span>
          <div><strong>CherryFlow</strong><small>Workflow Template Library</small></div>
        </Link>
        <nav>
          <Link href="/dashboard">Control Center</Link>
          <Link href="/builder">Builder</Link>
          <Link href="/canvas">Canvas</Link>
          <Link href="/models">Models</Link>
        </nav>
      </header>

      <section className="templateHero">
        <div>
          <p className="templateEyebrow">READY-TO-RUN WORKFLOWS</p>
          <h1>เริ่มงานจาก Template<br /><span>ไม่ต้องต่อกล่องว่างตั้งแต่ศูนย์</span></h1>
          <p>รวม Workflow งานจริงสำหรับเอกสาร ฝ่ายขาย HR บริการลูกค้า IT Security การเงิน และ ChatOps พร้อมส่ง Telegram, Discord และ LINE ทุก Template เปิดรันทันทีหรือใช้เป็นต้นแบบสร้าง Application ต่อได้</p>
        </div>
        <div className="templateHeroStats">
          <article><strong>{payload?.total ?? "—"}</strong><span>Templates</span></article>
          <article><strong>{payload?.featured ?? "—"}</strong><span>Featured</span></article>
          <article><strong>{payload?.categories.length ?? "—"}</strong><span>Categories</span></article>
        </div>
      </section>

      <section className="templateControls" aria-label="Template filters">
        <label className="templateSearch">
          <span>ค้นหา</span>
          <input value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="เช่น รายงาน, HR, Incident, Telegram, LINE" />
        </label>
        <div className="templateCategories">
          <button type="button" className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>ทั้งหมด</button>
          {(payload?.categories ?? []).map((item) => (
            <button type="button" className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>
              {categoryLabel(item)}
            </button>
          ))}
        </div>
      </section>

      {error && <div className="templateError">{error}</div>}

      <section className="templateResultsHeader">
        <div><p>{category === "all" ? "ทุกหมวด" : categoryLabel(category)}</p><h2>{templates.length} Workflow ที่ตรงกับการค้นหา</h2></div>
        <span>Local Qwen เมื่อเชื่อมโมเดล · Dry Run สำหรับ Connector ภายนอก</span>
      </section>

      <section className="templateGrid">
        {templates.map((template) => (
          <article className="templateCard" key={template.id}>
            <div className="templateCardHeader">
              <span className="templateIcon">{template.icon}</span>
              <div className="templateBadges">
                {template.featured && <span className="featuredBadge">แนะนำ</span>}
                {template.requiresFile && <span>ใช้ไฟล์</span>}
                {template.category === "integrations" && <span>ส่งภายนอก</span>}
              </div>
            </div>
            <p className="templateCategory">{categoryLabel(template.category)}</p>
            <h3>{template.name}</h3>
            <p className="templateDescription">{template.description}</p>
            <div className="templateTags">{template.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div>
            <div className="templateMeta">
              <span><strong>{template.inputCount}</strong> inputs</span>
              <span><strong>{template.outputCount}</strong> outputs</span>
              <span><strong>≈{template.estimatedMinutes}</strong> min</span>
            </div>
            <div className="templateActions">
              <Link className="templateRun" href={`/run/${template.id}`}>เปิดใช้งาน →</Link>
              <Link className="templateBuild" href={`/builder?workflow=${encodeURIComponent(template.id)}`}>สร้าง App</Link>
            </div>
          </article>
        ))}
      </section>

      {!error && payload && templates.length === 0 && (
        <section className="templateEmpty"><strong>ไม่พบ Template</strong><p>ลองเปลี่ยนคำค้นหรือเลือกหมวดอื่น มนุษย์ตั้งชื่อสิ่งเดียวกันได้หลายแบบอย่างน่าประทับใจอยู่แล้ว</p></section>
      )}
    </main>
  );
}
