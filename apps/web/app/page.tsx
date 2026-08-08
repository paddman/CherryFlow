import Link from "next/link";
import styles from "./home.module.css";

const features = [
  ["QW", "Local Qwen Runtime", "เชื่อม Qwen ผ่าน vLLM, SGLang, Ollama หรือ OpenAI-compatible endpoint ภายในองค์กร"],
  ["API", "API-first AI Platform", "รวม model endpoint, workflow, webhook และ application หลัง CherryFlow API"],
  ["TPL", "31 Ready-to-run Templates", "เริ่มงานเอกสาร ฝ่ายขาย HR บริการลูกค้า IT Security การเงิน ข้อมูล และโครงการได้ทันที"],
  ["ML", "Machine Learning Modules", "รองรับแนวทาง data preparation, classification, regression, clustering และ forecasting"],
  ["FLOW", "Workflow & Agent", "ประกอบ deterministic node, AI node, agent, database, file และ approval เป็น Flow เดียว"],
  ["OPS", "Operational Control Center", "เห็น runtime mode, workflow inventory, versions, models และ worker pools จากข้อมูล API จริง"],
] as const;

const useCases = [
  ["R", "AI Report & Document", "ใช้ Local Qwen วิเคราะห์ Excel, CSV และ PDF แล้วสร้างรายงานพร้อมดาวน์โหลด"],
  ["B", "Business Workflow Templates", "ใช้ Template สำเร็จรูปสำหรับ Proposal, Meeting, Sales, HR, Customer Service และ Project Management"],
  ["V", "Vision, OCR & Deep Learning", "เรียก OCR, object detection, image classification และ document AI ผ่าน GPU worker"],
  ["A", "Local AI Agent & Operations", "ใช้ Qwen หรือ OpenClaw เรียก tool ตรวจระบบ ขออนุมัติ และแจ้งผลผ่าน API"],
] as const;

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.shell}>
        <nav className={styles.nav}>
          <Link className={styles.brand} href="/">
            <span className={styles.logo}>C</span>
            <span className={styles.brandText}><strong>CherryFlow</strong><small>Local AI Workflow Platform</small></span>
          </Link>
          <div className={styles.navLinks}>
            <a href="#features">AI Stack</a>
            <a href="#use-cases">Use Cases</a>
            <Link href="/templates" prefetch={false}>Templates</Link>
            <Link href="/process-builder" prefetch={false}>Process Flow</Link>
            <Link href="/canvas" prefetch={false}>Canvas</Link>
            <Link href="/builder" prefetch={false}>Builder</Link>
            <Link href="/models" prefetch={false}>Models</Link>
            <Link className={styles.navButton} href="/dashboard" prefetch={false}>Control Center</Link>
          </div>
        </nav>
      </header>

      <section className={`${styles.hero} ${styles.shell}`}>
        <div className={styles.heroText}>
          <span className={styles.eyebrow}><span className={styles.eyebrowDot} />LOCAL QWEN · 31 WORKFLOW TEMPLATES · OPS READY</span>
          <h1>สร้างและควบคุมระบบ AI<br /><span className={styles.gradientText}>บน Infrastructure ของคุณเอง</span></h1>
          <p className={styles.heroLead}>CherryFlow เชื่อม Local Qwen, OpenAI-compatible API, Workflow และ Agent พร้อม Template งานจริงที่เปิดใช้ได้ทันที และ Control Center สำหรับดูสถานะจาก API จริง</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href="/templates" prefetch={false}>เลือก Workflow Template →</Link>
            <Link className={styles.secondaryButton} href="/dashboard" prefetch={false}>เปิด Control Center</Link>
          </div>
          <div className={styles.trustRow}>
            <span className={styles.trustItem}><span className={styles.check}>✓</span> Ready-to-run templates</span>
            <span className={styles.trustItem}><span className={styles.check}>✓</span> Validated workflow graph</span>
            <span className={styles.trustItem}><span className={styles.check}>✓</span> Local deterministic fallback</span>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.heroGlow} />
          <div className={styles.appCard}>
            <div className={styles.appTopbar}><div className={styles.dots}><span /><span /><span /></div><span className={styles.appStatus}>TEMPLATE LIBRARY READY</span></div>
            <div className={styles.canvas}>
              <div className={styles.canvasHeader}><div className={styles.canvasTitle}><strong>Reusable Business Workflow</strong><small>Template + Local Qwen + Validated Output</small></div><span className={styles.runButton}>Run Flow</span></div>
              <div className={styles.flow}>
                {[
                  ["TPL", "Choose Template", "Documents, Sales, HR, IT or Finance"],
                  ["IN", "Provide Context", "Form inputs, Excel, CSV, PDF or text"],
                  ["QW", "Local Qwen Task", "OpenAI-compatible endpoint with fallback"],
                  ["OUT", "Review & Publish", "Result, summary, checklist and next steps"],
                ].map(([icon, title, detail]) => (
                  <div className={styles.node} key={title}>
                    <span className={styles.nodeIcon}>{icon}</span>
                    <span className={styles.nodeText}><strong>{title}</strong><small>{detail}</small></span>
                    <span className={styles.nodeState} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.floatingCard}><strong>31 workflow templates</strong><div className={styles.progressTrack}><span /></div><small>Runnable now, extensible in Builder</small></div>
        </div>
      </section>

      <section className={`${styles.logoStrip} ${styles.shell}`}>
        <p>Local AI Infrastructure</p>
        <div className={styles.logoNames}><span>Qwen</span><span>vLLM</span><span>SGLang</span><span>Ollama</span><span>OpenAI API</span><span>OpenClaw</span><span>PostgreSQL</span><span>Redis</span><span>MinIO</span></div>
      </section>

      <section className={styles.section} id="features">
        <div className={styles.shell}>
          <div className={styles.sectionHeader}><span>Local AI Platform</span><h2>จาก Template ไปจนถึงระบบที่ดูแลได้จริง</h2><p>เริ่มจาก Workflow งานจริง ปรับใน Builder เชื่อม Local Qwen แล้วติดตาม Runtime, Versions, Models และ Workers จาก Control Center</p></div>
          <div className={styles.featureGrid}>
            {features.map(([icon, title, description]) => <article className={styles.featureCard} key={title}><span className={styles.featureIcon}>{icon}</span><h3>{title}</h3><p>{description}</p></article>)}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.workflowSection}`} id="use-cases">
        <div className={styles.shell}>
          <div className={styles.sectionHeader}><span>AI, Workflow and Operations</span><h2>งานประจำที่เริ่มใช้ได้โดยไม่ต้องสร้าง Flow ใหม่ทุกครั้ง</h2><p>Template ทุกตัวใช้ Workflow Contract และ Graph จริง จึงเปิดรันได้ทันที และนำไปสร้างเว็บไซต์หรือ Internal App ต่อได้</p></div>
          <div className={styles.workflowGrid}>
            {useCases.map(([icon, title, description]) => <article className={styles.useCase} key={title}><span className={styles.useCaseIcon}>{icon}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}
          </div>
        </div>
      </section>

      <section className={styles.section} id="architecture">
        <div className={styles.shell}>
          <div className={styles.sectionHeader}><span>Template-first Architecture</span><h2>เริ่มเร็ว แต่ยังควบคุมและตรวจสอบได้</h2><p>Template กำหนด Input, Output และ Graph ไว้ชัดเจน จากนั้น ai.task จึงประมวลผลผ่าน Local Qwen หรือ fallback โดยไม่ปล่อยให้โมเดลสร้างและรันโค้ดตามอำเภอใจ</p></div>
          <div className={styles.steps}>
            {[
              ["1", "เลือก Template", "เลือกจากงานเอกสาร ฝ่ายขาย HR บริการลูกค้า IT Security การเงิน ข้อมูล และโครงการ"],
              ["2", "กรอกข้อมูลหรืออัปโหลดไฟล์", "Workflow ตรวจ Input และส่งเฉพาะบริบทที่จำเป็นไปยัง Local Qwen"],
              ["3", "ตรวจผลและต่อยอด", "รับผลงาน สรุป Checklist และ Next Steps แล้วเปิด Builder เพื่อสร้าง App หรือ Publish"],
            ].map(([number, title, description]) => <article className={styles.step} key={number}><span className={styles.stepNumber}>{number}</span><h3>{title}</h3><p>{description}</p></article>)}
          </div>
        </div>
      </section>

      <section className={`${styles.cta} ${styles.shell}`}>
        <div className={styles.ctaCard}><div className={styles.ctaContent}><h2>ไม่ต้องเริ่มจาก Canvas ว่าง</h2><p>เลือก Template ที่ใกล้กับงาน กรอกข้อมูลแล้วรัน จากนั้นค่อยปรับ Workflow และหน้าตา Application ให้ตรงกับองค์กร</p></div><div className={styles.ctaActions}><Link className={styles.ctaLight} href="/templates" prefetch={false}>ดู Template ทั้งหมด →</Link></div></div>
      </section>

      <footer className={styles.footer}>
        <div className={`${styles.footerInner} ${styles.shell}`}><Link className={styles.brand} href="/"><span className={styles.logo}>C</span><span className={styles.brandText}><strong>CherryFlow</strong><small>Local AI Workflow Platform</small></span></Link><p>Local models. Reusable workflows. Controlled execution.</p><div className={styles.footerLinks}><Link href="/templates" prefetch={false}>Templates</Link><Link href="/dashboard" prefetch={false}>Dashboard</Link><Link href="/builder" prefetch={false}>Builder</Link><Link href="/models" prefetch={false}>Models</Link></div></div>
      </footer>
    </main>
  );
}
