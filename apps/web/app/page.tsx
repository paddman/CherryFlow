import Link from "next/link";
import styles from "./home.module.css";

const features = [
  ["QW", "Local Qwen Runtime", "เชื่อม Qwen ผ่าน vLLM, SGLang, Ollama หรือ OpenAI-compatible endpoint ภายในองค์กร"],
  ["API", "API-first AI Platform", "รวม model endpoint, workflow, webhook และ application หลัง CherryFlow API"],
  ["ML", "Machine Learning Modules", "รองรับแนวทาง data preparation, classification, regression, clustering และ forecasting"],
  ["DL", "Deep Learning Workers", "แยก GPU worker สำหรับ OCR, vision, speech, embedding และ document intelligence"],
  ["FLOW", "Workflow & Agent", "ประกอบ deterministic node, AI node, agent, database, file และ approval เป็น Flow เดียว"],
  ["APP", "Website & API Output", "Publish Workflow เป็นเว็บไซต์, internal app, API, file หรือ notification"],
] as const;

const useCases = [
  ["R", "AI Report & Document", "ใช้ Local Qwen วิเคราะห์ Excel, CSV และ PDF แล้วสร้างรายงานพร้อมดาวน์โหลด"],
  ["M", "Machine Learning Pipeline", "เตรียมข้อมูล ฝึกโมเดล ประเมินผล และนำ inference endpoint ไปใช้ใน Workflow"],
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
            <a href="#architecture">Architecture</a>
            <Link className={styles.navButton} href="/builder" prefetch={false}>เปิด Builder</Link>
          </div>
        </nav>
      </header>

      <section className={`${styles.hero} ${styles.shell}`}>
        <div className={styles.heroText}>
          <span className={styles.eyebrow}><span className={styles.eyebrowDot} />LOCAL QWEN · API-FIRST · ML/DL READY</span>
          <h1>สร้างระบบ AI ที่รันใน<br /><span className={styles.gradientText}>Infrastructure ของคุณเอง</span></h1>
          <p className={styles.heroLead}>CherryFlow เชื่อม Local Qwen, OpenAI-compatible API, Workflow, Agent, Machine Learning และ Deep Learning Worker ให้ทำงานร่วมกัน พร้อมเปิดใช้งานเป็น API หรือเว็บไซต์</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href="/builder" prefetch={false}>เปิด Local AI Builder →</Link>
            <a className={styles.secondaryButton} href="#architecture">ดู Architecture</a>
          </div>
          <div className={styles.trustRow}>
            <span className={styles.trustItem}><span className={styles.check}>✓</span> Qwen ผ่าน Local API</span>
            <span className={styles.trustItem}><span className={styles.check}>✓</span> Model-independent</span>
            <span className={styles.trustItem}><span className={styles.check}>✓</span> CPU / GPU Workers</span>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.heroGlow} />
          <div className={styles.appCard}>
            <div className={styles.appTopbar}><div className={styles.dots}><span /><span /><span /></div><span className={styles.appStatus}>LOCAL AI ONLINE</span></div>
            <div className={styles.canvas}>
              <div className={styles.canvasHeader}><div className={styles.canvasTitle}><strong>Local Qwen Intelligence Flow</strong><small>API + ML/DL Workers · Validated</small></div><span className={styles.runButton}>Run Flow</span></div>
              <div className={styles.flow}>
                {[
                  ["API", "Receive Request", "Form, Webhook or Internal API"],
                  ["QW", "Local Qwen Inference", "vLLM / SGLang / Ollama"],
                  ["GPU", "ML / Deep Learning", "OCR, Vision, Forecasting"],
                  ["OUT", "Publish Result", "Website, API, File or Notification"],
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
          <div className={styles.floatingCard}><strong>Local AI execution</strong><div className={styles.progressTrack}><span /></div><small>Qwen + GPU worker running</small></div>
        </div>
      </section>

      <section className={`${styles.logoStrip} ${styles.shell}`}>
        <p>Local AI Infrastructure</p>
        <div className={styles.logoNames}><span>Qwen</span><span>vLLM</span><span>SGLang</span><span>Ollama</span><span>OpenAI API</span><span>OpenClaw</span><span>PostgreSQL</span><span>Redis</span><span>MinIO</span></div>
      </section>

      <section className={styles.section} id="features">
        <div className={styles.shell}>
          <div className={styles.sectionHeader}><span>Local AI Platform</span><h2>จาก Local Model ไปจนถึง AI Application</h2><p>CherryFlow เป็น orchestration layer ระหว่าง model server, API, workflow, data, agent และ ML/DL worker</p></div>
          <div className={styles.featureGrid}>
            {features.map(([icon, title, description]) => <article className={styles.featureCard} key={title}><span className={styles.featureIcon}>{icon}</span><h3>{title}</h3><p>{description}</p></article>)}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.workflowSection}`} id="use-cases">
        <div className={styles.shell}>
          <div className={styles.sectionHeader}><span>AI, ML and Deep Learning</span><h2>ใช้ Local Qwen ร่วมกับโมเดลเฉพาะทาง</h2><p>แยกงานให้ LLM, deterministic module และ ML/DL model ทำในส่วนที่เหมาะสม</p></div>
          <div className={styles.workflowGrid}>
            {useCases.map(([icon, title, description]) => <article className={styles.useCase} key={title}><span className={styles.useCaseIcon}>{icon}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}
          </div>
        </div>
      </section>

      <section className={styles.section} id="architecture">
        <div className={styles.shell}>
          <div className={styles.sectionHeader}><span>API-first Architecture</span><h2>หนึ่ง Platform สำหรับ Local AI ทั้งระบบ</h2><p>Website และ Workflow เรียก CherryFlow API ก่อน ระบบจึง route ไปยัง Qwen, Agent หรือ Worker ที่เหมาะสม</p></div>
          <div className={styles.steps}>
            {[
              ["1", "เชื่อม Local Qwen", "กำหนด OpenAI-compatible endpoint และ model เช่น Qwen บน vLLM หรือ SGLang"],
              ["2", "ประกอบ AI Workflow", "ต่อ API, data, model, agent, document, ML/DL และ approval modules"],
              ["3", "เปิดใช้งานจริง", "รันผ่าน API หรือ Publish เป็น internal app และ public website"],
            ].map(([number, title, description]) => <article className={styles.step} key={number}><span className={styles.stepNumber}>{number}</span><h3>{title}</h3><p>{description}</p></article>)}
          </div>
        </div>
      </section>

      <section className={`${styles.cta} ${styles.shell}`}>
        <div className={styles.ctaCard}><div className={styles.ctaContent}><h2>เริ่มจาก Local Qwen ที่คุณมีอยู่</h2><p>ต่อ endpoint เข้ากับ CherryFlow แล้วสร้าง Workflow, API และ AI Application จาก Infrastructure เดิม</p></div><div className={styles.ctaActions}><Link className={styles.ctaLight} href="/builder" prefetch={false}>เปิด Local AI Builder →</Link></div></div>
      </section>

      <footer className={styles.footer}>
        <div className={`${styles.footerInner} ${styles.shell}`}><Link className={styles.brand} href="/"><span className={styles.logo}>C</span><span className={styles.brandText}><strong>CherryFlow</strong><small>Local AI Workflow Platform</small></span></Link><p>Local models. Standard APIs. Controlled execution.</p><div className={styles.footerLinks}><Link href="/builder" prefetch={false}>Builder</Link><a href="#features">AI Stack</a></div></div>
      </footer>
    </main>
  );
}
