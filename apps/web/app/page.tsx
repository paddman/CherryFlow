import Link from "next/link";
import styles from "./home.module.css";

const features = [
  ["QW", "Local Qwen Runtime", "เชื่อม Qwen ผ่าน vLLM, SGLang, Ollama หรือ OpenAI-compatible endpoint ภายในองค์กร"],
  ["EX", "100+ Exchange APIs", "เชื่อม Exchange ผ่าน CCXT Unified API พร้อม Capability Check และพารามิเตอร์เฉพาะ Exchange"],
  ["TPL", "44 Ready-to-run Templates", "เริ่มงานธุรกิจ ChatOps Market Data Portfolio Paper Trading และ Order Operations ได้ทันที"],
  ["RISK", "Trading Risk Engine", "Paper Trading, Exchange/Symbol Allowlist, Notional Limit, Leverage Limit, Sandbox และ Human Approval"],
  ["FLOW", "Workflow & Agent", "ประกอบ AI, Agent, Exchange, Notification, File และ Approval เป็น Flow เดียว"],
  ["OPS", "Operational Control Center", "เห็น runtime mode, workflow inventory, versions, models และ worker pools จากข้อมูล API จริง"],
] as const;

const useCases = [
  ["M", "Market Data & Backtest", "ดึง Ticker และ OHLCV แบบ Unified เพื่อทำ Chart, Indicator, Dataset และ Backtest"],
  ["P", "Paper Trading", "จำลอง Spot หรือ Derivatives Order พร้อม Precision, Notional, Fee และ Risk Checks โดยไม่ส่งเงินจริง"],
  ["T", "Controlled Live Trading", "ส่งหรือยกเลิก Order หลังผ่าน Feature Flag, Sandbox Policy, Approval Reference, Confirmation และ Risk Limit"],
  ["N", "Trade Notification & ChatOps", "ส่งสถานะกลยุทธ์ Order และ Incident ไป Telegram, Discord หรือ LINE โดย Secret อยู่ฝั่ง Server"],
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
          <span className={styles.eyebrow}><span className={styles.eyebrowDot} />LOCAL QWEN · 44 TEMPLATES · 100+ CRYPTO EXCHANGES · CHATOPS</span>
          <h1>สร้างและควบคุมระบบ AI<br /><span className={styles.gradientText}>รวมถึง Crypto Trading Workflow</span></h1>
          <p className={styles.heroLead}>CherryFlow เชื่อม Local Qwen, Workflow, Agent, Telegram, Discord, LINE และ Exchange จำนวนมากผ่าน CCXT พร้อม Paper Trading และ Risk Gate ก่อนอนุญาตคำสั่งเงินจริง</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href="/templates" prefetch={false}>เลือก Crypto Workflow →</Link>
            <Link className={styles.secondaryButton} href="/dashboard" prefetch={false}>เปิด Control Center</Link>
          </div>
          <div className={styles.trustRow}>
            <span className={styles.trustItem}><span className={styles.check}>✓</span> Paper trading by default</span>
            <span className={styles.trustItem}><span className={styles.check}>✓</span> Server-side API credentials</span>
            <span className={styles.trustItem}><span className={styles.check}>✓</span> Approval before live order</span>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.heroGlow} />
          <div className={styles.appCard}>
            <div className={styles.appTopbar}><div className={styles.dots}><span /><span /><span /></div><span className={styles.appStatus}>CRYPTO RISK GATES READY</span></div>
            <div className={styles.canvas}>
              <div className={styles.canvasHeader}><div className={styles.canvasTitle}><strong>Controlled Crypto Trading Flow</strong><small>CCXT + Risk Engine + Approval + ChatOps</small></div><span className={styles.runButton}>Run Flow</span></div>
              <div className={styles.flow}>
                {[
                  ["DATA", "Market Data", "Ticker, markets and normalized OHLCV"],
                  ["PAPER", "Paper Trade", "Precision, fee and notional simulation"],
                  ["RISK", "Validate Risk", "Allowlist, sandbox, leverage and approval"],
                  ["ORDER", "Execute & Notify", "Exchange order plus Telegram, Discord or LINE"],
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
          <div className={styles.floatingCard}><strong>44 workflow templates</strong><div className={styles.progressTrack}><span /></div><small>Including 9 crypto trading workflows</small></div>
        </div>
      </section>

      <section className={`${styles.logoStrip} ${styles.shell}`}>
        <p>AI, Exchange and Messaging Infrastructure</p>
        <div className={styles.logoNames}><span>Qwen</span><span>CCXT</span><span>Binance</span><span>OKX</span><span>Bybit</span><span>Bitget</span><span>Hyperliquid</span><span>Telegram</span><span>Discord</span><span>LINE</span></div>
      </section>

      <section className={styles.section} id="features">
        <div className={styles.shell}>
          <div className={styles.sectionHeader}><span>Local AI and Trading Platform</span><h2>จาก Market Data ไปจนถึงคำสั่งซื้อขายที่มีรั้วกั้น</h2><p>ใช้ Unified Exchange Adapter ลดงานต่อ API ซ้ำ และบังคับ Paper Trading, Sandbox, Approval และ Risk Limit ก่อน Account-changing Operation</p></div>
          <div className={styles.featureGrid}>
            {features.map(([icon, title, description]) => <article className={styles.featureCard} key={title}><span className={styles.featureIcon}>{icon}</span><h3>{title}</h3><p>{description}</p></article>)}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.workflowSection}`} id="use-cases">
        <div className={styles.shell}>
          <div className={styles.sectionHeader}><span>Crypto, AI and ChatOps</span><h2>ระบบเทรดไม่ควรเริ่มจากปุ่ม Buy ที่เชื่อใจทุก Input</h2><p>Workflow แยก Market Data, Paper Simulation, Private Read, Live Order และ Notification ออกจากกัน พร้อมเก็บผล Risk Checks ในทุก Run</p></div>
          <div className={styles.workflowGrid}>
            {useCases.map(([icon, title, description]) => <article className={styles.useCase} key={title}><span className={styles.useCaseIcon}>{icon}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}
          </div>
        </div>
      </section>

      <section className={styles.section} id="architecture">
        <div className={styles.shell}>
          <div className={styles.sectionHeader}><span>Unified Exchange Architecture</span><h2>หนึ่ง Workflow Contract เชื่อม Exchange หลายเจ้า</h2><p>CCXT ทำ Normalization ของ Market, Ticker, OHLCV, Balance และ Order ส่วน CherryFlow ทำ Allowlist, Secret Boundary, Approval และ Run Audit</p></div>
          <div className={styles.steps}>
            {[
              ["1", "ติดตั้ง CCXT และตั้ง Credential Profile", "API Key อยู่ใน Environment ฝั่ง Server และควรปิดสิทธิ์ Withdrawal"],
              ["2", "เริ่มด้วย Catalog, Market Data และ Paper Trade", "ตรวจ Capability, Symbol, Precision, Fee และ Estimated Notional ก่อน"],
              ["3", "เปิด Sandbox หรือ Live แบบมี Approval", "เปิด Feature Flag กำหนด Allowlist และ Limit แล้วจึงยืนยันคำสั่งจาก Workflow"],
            ].map(([number, title, description]) => <article className={styles.step} key={number}><span className={styles.stepNumber}>{number}</span><h3>{title}</h3><p>{description}</p></article>)}
          </div>
        </div>
      </section>

      <section className={`${styles.cta} ${styles.shell}`}>
        <div className={styles.ctaCard}><div className={styles.ctaContent}><h2>เริ่มจาก Paper Trading</h2><p>ติดตั้ง Adapter เลือก Exchange ดึง Market Data และจำลอง Order ให้ผ่าน Risk Checks ก่อนเปิด Sandbox หรือเงินจริง</p></div><div className={styles.ctaActions}><Link className={styles.ctaLight} href="/run/crypto-paper-order" prefetch={false}>เปิด Paper Trade →</Link></div></div>
      </section>

      <footer className={styles.footer}>
        <div className={`${styles.footerInner} ${styles.shell}`}><Link className={styles.brand} href="/"><span className={styles.logo}>C</span><span className={styles.brandText}><strong>CherryFlow</strong><small>Local AI Workflow Platform</small></span></Link><p>Local models. Unified exchanges. Controlled execution.</p><div className={styles.footerLinks}><Link href="/templates" prefetch={false}>Templates</Link><Link href="/dashboard" prefetch={false}>Dashboard</Link><Link href="/builder" prefetch={false}>Builder</Link><Link href="/models" prefetch={false}>Models</Link></div></div>
      </footer>
    </main>
  );
}
