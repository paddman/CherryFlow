import Link from "next/link";
import styles from "./home.module.css";

const features = [
  {
    icon: "01",
    title: "สร้าง Workflow ด้วยภาพ",
    description: "ลาก Node ต่อเส้น ตั้งค่า และตรวจสอบ Flow ก่อนรัน โดยไม่ต้องเขียนระบบ orchestration เอง",
  },
  {
    icon: "AI",
    title: "AI ช่วยสร้างเว็บไซต์",
    description: "อธิบายหน้าที่ต้องการด้วยภาษาไทยหรืออังกฤษ แล้ว CherryFlow สร้างหน้าเว็บที่ผูกกับ Workflow ให้ทันที",
  },
  {
    icon: "API",
    title: "เชื่อมระบบเดิมได้ง่าย",
    description: "รองรับ HTTP, Webhook, Database, LLM, File และ Agent ผ่าน Module Registry ที่ขยายเพิ่มได้",
  },
  {
    icon: "RUN",
    title: "ติดตามทุก Node",
    description: "เห็นสถานะ queued, running, completed และ failed พร้อมผลลัพธ์และประวัติการทำงานรายขั้นตอน",
  },
  {
    icon: "PUB",
    title: "Publish เป็นเว็บใช้งานจริง",
    description: "บันทึก Version, Preview, Rollback และเผยแพร่เป็น URL สำหรับลูกค้า ทีมงาน หรือประชาชน",
  },
  {
    icon: "SAFE",
    title: "ออกแบบให้ปลอดภัย",
    description: "ใช้ UI Schema แบบ allowlist ไม่รัน JavaScript ที่ AI สร้างเอง และตรวจ input/output binding ก่อนเผยแพร่",
  },
];

const useCases = [
  {
    icon: "R",
    title: "AI Report Generator",
    description: "รับ Excel, CSV หรือ PDF วิเคราะห์ข้อมูล สร้างสรุป ตาราง และรายงานดาวน์โหลด",
  },
  {
    icon: "S",
    title: "Support & Operations",
    description: "รับ Incident ตรวจระบบ เรียก Agent ขออนุมัติ และแจ้งผลผ่าน LINE หรืออีเมล",
  },
  {
    icon: "D",
    title: "Document Automation",
    description: "Extract ข้อมูล ตรวจเอกสาร เติมแบบฟอร์ม และสร้าง PDF หรือ DOCX ตาม Template",
  },
  {
    icon: "G",
    title: "Government Service",
    description: "สร้างบริการออนไลน์จาก Workflow พร้อมหน้าเว็บ ฟอร์ม สถานะ และผลลัพธ์ในระบบเดียว",
  },
];

const steps = [
  {
    number: "1",
    title: "เลือกหรือสร้าง Workflow",
    description: "เริ่มจาก Template หรือประกอบ Node ให้ตรงกับกระบวนการทำงานของคุณ",
  },
  {
    number: "2",
    title: "ให้ AI สร้างหน้าเว็บ",
    description: "พิมพ์ Prompt บอกธีม เนื้อหา และรูปแบบหน้า ระบบสร้าง Preview ที่เชื่อมกับ Flow จริง",
  },
  {
    number: "3",
    title: "ทดสอบและ Publish",
    description: "ลองรัน ตรวจผล บันทึก Version แล้วเผยแพร่เป็น URL พร้อมใช้งาน",
  },
];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.shell}>
        <nav className={styles.nav} aria-label="Main navigation">
          <Link className={styles.brand} href="/">
            <span className={styles.logo}>C</span>
            <span className={styles.brandText}>
              <strong>CherryFlow</strong>
              <small>AI Workflow Platform</small>
            </span>
          </Link>

          <div className={styles.navLinks}>
            <a href="#features">ความสามารถ</a>
            <a href="#use-cases">ตัวอย่างงาน</a>
            <a href="#how-it-works">วิธีใช้งาน</a>
            <Link className={styles.navButton} href="/builder">เปิด Builder</Link>
          </div>
        </nav>
      </header>

      <section className={`${styles.hero} ${styles.shell}`}>
        <div className={styles.heroText}>
          <span className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />
            AI-FIRST WORKFLOW & WEBSITE BUILDER
          </span>

          <h1>
            เปลี่ยนไอเดียให้เป็น
            <br />
            <span className={styles.gradientText}>Workflow ที่ใช้งานได้จริง</span>
          </h1>

          <p className={styles.heroLead}>
            สร้างกระบวนการอัตโนมัติ เชื่อม AI และระบบเดิม แล้วให้ CherryFlow สร้างหน้าเว็บสำหรับใช้งาน Workflow นั้นให้ครบในแพลตฟอร์มเดียว
          </p>

          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href="/builder">
              เริ่มสร้าง Workflow <span aria-hidden="true">→</span>
            </Link>
            <a className={styles.secondaryButton} href="#how-it-works">ดูวิธีทำงาน</a>
          </div>

          <div className={styles.trustRow}>
            <span className={styles.trustItem}><span className={styles.check}>✓</span> ใช้ Local AI ได้</span>
            <span className={styles.trustItem}><span className={styles.check}>✓</span> Version & Rollback</span>
            <span className={styles.trustItem}><span className={styles.check}>✓</span> Publish เป็น URL</span>
          </div>
        </div>

        <div className={styles.heroVisual} aria-label="CherryFlow workflow preview">
          <div className={styles.heroGlow} />
          <div className={styles.appCard}>
            <div className={styles.appTopbar}>
              <div className={styles.dots}><span /><span /><span /></div>
              <span className={styles.appStatus}>WORKFLOW READY</span>
            </div>

            <div className={styles.canvas}>
              <div className={styles.canvasHeader}>
                <div className={styles.canvasTitle}>
                  <strong>AI Report Workflow</strong>
                  <small>4 Nodes · Validated</small>
                </div>
                <span className={styles.runButton}>Run Flow</span>
              </div>

              <div className={styles.flow}>
                <div className={styles.node}>
                  <span className={styles.nodeIcon}>IN</span>
                  <span className={styles.nodeText}><strong>Upload Source</strong><small>Excel, CSV, PDF</small></span>
                  <span className={styles.nodeState} />
                </div>
                <div className={styles.node}>
                  <span className={styles.nodeIcon}>AI</span>
                  <span className={styles.nodeText}><strong>Analyze Data</strong><small>Qwen / OpenAI-compatible</small></span>
                  <span className={styles.nodeState} />
                </div>
                <div className={styles.node}>
                  <span className={styles.nodeIcon}>OK</span>
                  <span className={styles.nodeText}><strong>Human Approval</strong><small>Review before publish</small></span>
                  <span className={styles.nodeState} />
                </div>
                <div className={styles.node}>
                  <span className={styles.nodeIcon}>OUT</span>
                  <span className={styles.nodeText}><strong>Generate Report</strong><small>Summary, table and file</small></span>
                  <span className={styles.nodeState} />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.floatingCard}>
            <strong>Workflow execution</strong>
            <div className={styles.progressTrack}><span /></div>
            <small>3 of 4 nodes completed</small>
          </div>
        </div>
      </section>

      <section className={`${styles.logoStrip} ${styles.shell}`}>
        <p>เชื่อมต่อกับระบบที่คุณใช้อยู่</p>
        <div className={styles.logoNames}>
          <span>OpenAI-compatible</span>
          <span>OpenClaw</span>
          <span>PostgreSQL</span>
          <span>Redis</span>
          <span>MinIO</span>
          <span>LINE</span>
        </div>
      </section>

      <section className={styles.section} id="features">
        <div className={styles.shell}>
          <div className={styles.sectionHeader}>
            <span>One platform, complete workflow</span>
            <h2>ตั้งแต่ Flow จนถึงหน้าเว็บสำหรับผู้ใช้</h2>
            <p>CherryFlow รวม Workflow Engine, AI Planner, Website Builder และ Runtime ไว้ในระบบเดียว ลดงานเขียนระบบซ้ำและทำให้เปิดบริการใหม่ได้เร็วขึ้น</p>
          </div>

          <div className={styles.featureGrid}>
            {features.map((feature) => (
              <article className={styles.featureCard} key={feature.title}>
                <span className={styles.featureIcon}>{feature.icon}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.workflowSection}`} id="use-cases">
        <div className={styles.shell}>
          <div className={styles.sectionHeader}>
            <span>Built for real work</span>
            <h2>ใช้ได้กับงานที่ต้องมี Input, Process และ Output</h2>
            <p>เริ่มจากงานภายในองค์กร ไปจนถึงบริการออนไลน์ที่ให้ลูกค้าหรือประชาชนใช้งานเอง</p>
          </div>

          <div className={styles.workflowGrid}>
            {useCases.map((item) => (
              <article className={styles.useCase} key={item.title}>
                <span className={styles.useCaseIcon}>{item.icon}</span>
                <div><h3>{item.title}</h3><p>{item.description}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} id="how-it-works">
        <div className={styles.shell}>
          <div className={styles.sectionHeader}>
            <span>Simple by design</span>
            <h2>สร้างบริการใหม่ใน 3 ขั้นตอน</h2>
            <p>แยก Workflow ออกจากหน้าตา ทำให้เปลี่ยนกระบวนการหรือดีไซน์ได้โดยไม่ต้องรื้อระบบทั้งหมด</p>
          </div>

          <div className={styles.steps}>
            {steps.map((step) => (
              <article className={styles.step} key={step.number}>
                <span className={styles.stepNumber}>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.cta} ${styles.shell}`}>
        <div className={styles.ctaCard}>
          <div className={styles.ctaContent}>
            <h2>เริ่มสร้าง CherryFlow แรกของคุณ</h2>
            <p>ลองสร้าง AI Report Website จาก Workflow ตัวอย่าง แล้ว Preview, Run และ Publish ได้ทันที</p>
          </div>
          <div className={styles.ctaActions}>
            <Link className={styles.ctaLight} href="/builder">เปิด AI Builder →</Link>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={`${styles.footerInner} ${styles.shell}`}>
          <Link className={styles.brand} href="/">
            <span className={styles.logo}>C</span>
            <span className={styles.brandText}><strong>CherryFlow</strong><small>AI Workflow Platform</small></span>
          </Link>
          <p>AI proposes. CherryFlow validates and executes.</p>
          <div className={styles.footerLinks}>
            <Link href="/builder">Builder</Link>
            <a href="#features">Features</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
