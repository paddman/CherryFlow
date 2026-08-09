import Link from "next/link";
import styles from "./home.module.css";

const features = [
  ["QW", "Local Qwen Runtime", "เชื่อม Qwen ผ่าน vLLM, SGLang, Ollama หรือ OpenAI-compatible endpoint ภายในองค์กร"],
  ["API", "API-first AI Platform", "รวม model endpoint, workflow, webhook และ application หลัง CherryFlow API"],
  ["TPL", "35 Ready-to-run Templates", "เริ่มงานเอกสาร ฝ่ายขาย HR บริการลูกค้า IT Security การเงิน ข้อมูล โครงการ และ ChatOps ได้ทันที"],
  ["CHAT", "Telegram, Discord & LINE", "ส่งข้อความจาก Workflow ผ่าน Telegram Bot API, Discord Webhook และ LINE Messaging API ด้วย Secret ฝั่ง Server"],
  ["FLOW", "Workflow & Agent", "ประกอบ deterministic node, AI node, agent, database, file, notification และ approval เป็น Flow เดียว"],
  ["OPS", "Operational Control Center", "เห็น runtime mode, workflow inventory, versions, models และ worker pools จากข้อมูล API จริง"],
] as const;

const useCases = [
  ["R", "AI Report & Document", "ใช้ Local Qwen วิเคราะห์ Excel, CSV และ PDF แล้วสร้างรายงานพร้อมดาวน์โหลด"],
  ["B", "Business Workflow Templates", "ใช้ Template สำเร็จรูปสำหรับ Proposal, Meeting, Sales, HR, Customer Service และ Project Management"],
  ["N", "Notification & ChatOps", "ส่ง Alert, สถานะงาน และผลอนุมัติไป Telegram, Discord หรือ LINE พร้อม Dry Run และการยืนยันก่อนส่งจริง"],
  ["A", "Local AI Agent & Operations", "ใช้ Qwen หรือ OpenClaw เรียก Tool ตรวจระบบ ขออนุมัติ และส่งผลต่อไปยังช่องทางที่กำหนด"],
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
          <span className={styles.eyebrow}><span className={styles.eyebrowDot} />LOCAL QWEN · 35 TEMPLATES · TELEGRAM · DISCORD · LINE</span>
          <h1>สร้างและควบคุมระบบ AI<br /><span className={styles.gradientText}>บน Infrastructure ของคุณเอง</span></h1>
          <p className={styles.heroLead}>CherryFlow เชื่อม Local Qwen, Workflow และ Agent พร้อม Template งานจริง และส่งผลไป Telegram, Discord หรือ LINE โดย Credential ไม่ออกจากฝั่ง Server</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href="/templates" prefetch={false}>เลือก Workflow Template →</Link>
            <Link className={styles.secondaryButton} href="/dashboard" prefetch={false}>เปิด Control Center</Link>
          </div>
          <div className={styles.trustRow}>
            <span className={styles.trustItem}><span className={styles.check}>✓</span> Server-side connector secrets</span>
            <span className={styles.trustItem}><span className={styles.check}>✓</span> Dry run before delivery</span>
            <span className={styles.trustItem}><span className={styles.check}>✓</span> Explicit send confirmation</span>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.heroGlow} />
          <div className={styles.appCard}>
            <div className={styles.appTopbar}><div className={styles.dots}><span /><span /><span /></div><span className={styles.appStatus}>CHATOPS CONNECTORS READY</span></div>
            <div className={styles.canvas}>
              <div className={styles.canvasHeader}><div className={styles.canvasTitle}><strong>AI-to-ChatOps Workflow</strong><small>Template + Local Qwen + Controlled Delivery</small></div><span className={styles.runButton}>Run Flow</span></div>
              <div className={styles.flow}>
                {[
                  ["TPL", "Choose Workflow", "Incident, approval, report or business task"],
                  ["QW", "Analyze with Local Qwen", "Structured output with deterministic fallback"],
                  ["OK", "Review & Confirm", "Dry run and explicit external-action gate"],
                  ["MSG", "Dispatch Notification", "Telegram, Discord, LINE or multiple channels"],
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
          <div className={styles.floatingCard}><strong>35 workflow templates</strong><div className={styles.progressTrack}><span /></div><small>Including 4 notification workflows</small></div>
        </div>
      </section>

      <section className={`${styles.logoStrip} ${styles.shell}`}>
        <p>Local AI and Messaging Infrastructure</p>
        <div className={styles.logoNames}><span>Qwen</span><span>vLLM</span><span>SGLang</span><span>OpenAI API</span><span>OpenClaw</span><span>Telegram</span><span>Discord</span><span>LINE</span><span>PostgreSQL</span><span>Redis</span></div>
      </section>

      <section className={styles.section} id="features">
        <div className={styles.shell}>
          <div className={styles.sectionHeader}><span>Local AI Platform</span><h2>จาก Template ไปจนถึงการแจ้งเตือนที่ควบคุมได้</h2><p>เริ่มจาก Workflow งานจริง เชื่อม Local Qwen ตรวจผลก่อนส่ง และติดตาม Runtime, Versions, Models และ Workers จาก Control Center</p></div>
          <div className={styles.featureGrid}>
            {features.map(([icon, title, description]) => <article className={styles.featureCard} key={title}><span className={styles.featureIcon}>{icon}</span><h3>{title}</h3><p>{description}</p></article>)}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.workflowSection}`} id="use-cases">
        <div className={styles.shell}>
          <div className={styles.sectionHeader}><span>AI, Workflow and ChatOps</span><h2>ให้งานจบที่ช่องทางที่ทีมใช้อยู่จริง</h2><p>Workflow สร้างผลลัพธ์ ตรวจสอบเงื่อนไข แล้วส่งข้อความออกไปอย่างมีหลักฐาน แทนการให้คนคัดลอกข้อความข้ามหน้าจอจนผิดห้องตามธรรมเนียมองค์กร</p></div>
          <div className={styles.workflowGrid}>
            {useCases.map(([icon, title, description]) => <article className={styles.useCase} key={title}><span className={styles.useCaseIcon}>{icon}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}
          </div>
        </div>
      </section>

      <section className={styles.section} id="architecture">
        <div className={styles.shell}>
          <div className={styles.sectionHeader}><span>Controlled Connector Architecture</span><h2>Secret อยู่ Server และการส่งจริงต้องยืนยัน</h2><p>Canvas เก็บเฉพาะประเภท Module และการตั้งค่าที่ไม่ลับ ส่วน Bot Token, Webhook URL และ Channel Access Token อ่านจาก Environment ฝั่ง API</p></div>
          <div className={styles.steps}>
            {[
              ["1", "เลือก Template หรือ Module", "ใช้ Telegram, Discord, LINE หรือ Multi-channel Notification"],
              ["2", "ทดสอบด้วย Dry Run", "ตรวจข้อความ การแบ่งข้อความ และปลายทางโดยไม่เรียก Provider"],
              ["3", "ยืนยันและส่งจริง", "ปิด Dry Run เปิด confirmSend แล้วตรวจผลแยกแต่ละช่องทางจาก Run Output"],
            ].map(([number, title, description]) => <article className={styles.step} key={number}><span className={styles.stepNumber}>{number}</span><h3>{title}</h3><p>{description}</p></article>)}
          </div>
        </div>
      </section>

      <section className={`${styles.cta} ${styles.shell}`}>
        <div className={styles.ctaCard}><div className={styles.ctaContent}><h2>เริ่มด้วย Dry Run ก่อน</h2><p>ตั้งค่า Credential ฝั่ง Server เลือก Template แจ้งเตือน ตรวจข้อความ แล้วจึงเปิดการส่งจริงเมื่อพร้อม</p></div><div className={styles.ctaActions}><Link className={styles.ctaLight} href="/templates" prefetch={false}>ดู Notification Templates →</Link></div></div>
      </section>

      <footer className={styles.footer}>
        <div className={`${styles.footerInner} ${styles.shell}`}><Link className={styles.brand} href="/"><span className={styles.logo}>C</span><span className={styles.brandText}><strong>CherryFlow</strong><small>Local AI Workflow Platform</small></span></Link><p>Local models. Controlled workflows. Server-side connectors.</p><div className={styles.footerLinks}><Link href="/templates" prefetch={false}>Templates</Link><Link href="/dashboard" prefetch={false}>Dashboard</Link><Link href="/builder" prefetch={false}>Builder</Link><Link href="/models" prefetch={false}>Models</Link></div></div>
      </footer>
    </main>
  );
}
