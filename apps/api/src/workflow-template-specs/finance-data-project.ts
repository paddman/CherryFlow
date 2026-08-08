import { area, priorityOptions, select, text, upload, type TaskTemplateSpec } from "./shared.js";

export const financeDataProjectTemplateSpecs: TaskTemplateSpec[] = [
  {
    id: "budget-variance-explainer", name: "Budget Variance Explainer", description: "อธิบาย Actual เทียบ Budget แยก Driver, Impact และ Action โดยไม่สร้างตัวเลข",
    category: "finance-data-project", icon: "VAR", tags: ["Budget", "Variance", "Finance"], featured: true, estimatedMinutes: 6, requiresFile: true,
    starterPrompt: "สร้างเว็บวิเคราะห์ Budget Variance จาก Excel หรือ CSV", role: "FP&A Analyst",
    instructions: "วิเคราะห์ Budget vs Actual จากข้อมูล แยก Favorable/Unfavorable, Absolute/Percent Variance เมื่อคำนวณได้, Main Driver, One-off, Trend, Forecast Risk และ Management Action ระบุข้อมูลที่ขาด",
    fileField: "budgetFile",
    inputs: [text("reportName", "ชื่อรายงาน", true), text("period", "งวดหรือช่วงเวลา", true), area("businessContext", "บริบทธุรกิจ"), area("materiality", "เกณฑ์สาระสำคัญ"), upload("budgetFile", "ไฟล์ Budget และ Actual", [".xlsx", ".csv"], true)],
  },
  {
    id: "procurement-comparison", name: "Procurement Comparison", description: "เปรียบเทียบผู้ขาย ราคา เงื่อนไข ความเสี่ยง และข้อควรเจรจาอย่างโปร่งใส",
    category: "finance-data-project", icon: "RFQ", tags: ["Procurement", "Vendor", "Comparison"], featured: true, estimatedMinutes: 6, requiresFile: true,
    starterPrompt: "สร้างเว็บเปรียบเทียบ Vendor จากไฟล์ใบเสนอราคา", role: "Procurement Analyst",
    instructions: "เปรียบเทียบราคา ขอบเขต SLA ระยะส่งมอบ การรับประกัน การชำระเงิน Compliance Dependency และ Risk แยกข้อเท็จจริงจากข้อเสนอแนะ ห้ามเลือกผู้ชนะเมื่อเกณฑ์ไม่ครบ",
    fileField: "comparisonFile",
    inputs: [text("purchaseTitle", "รายการจัดซื้อ", true), area("requirements", "ความต้องการและ Must-have", true), area("evaluationCriteria", "เกณฑ์ประเมิน", true), upload("comparisonFile", "ตารางหรือใบเสนอราคา", [".xlsx", ".csv", ".pdf", ".txt"], true)],
  },
  {
    id: "project-status-report", name: "Project Status Report", description: "สร้างรายงานสถานะโครงการแบบผู้บริหาร พร้อม RAG, Milestone, Risk และ Decision",
    category: "finance-data-project", icon: "PMO", tags: ["Project", "Status", "PMO"], featured: true, estimatedMinutes: 4, requiresFile: false,
    starterPrompt: "สร้างเว็บ Project Status Report แบบ RAG พร้อม Milestone, Risk และ Decision", role: "PMO และ Project Manager",
    instructions: "จัดทำ Executive Status, Overall RAG พร้อมเหตุผล, Accomplishment, Milestone, Schedule/Budget/Scope, Risk, Issue, Dependency, Decision Needed และ Next Period Plan ใช้เฉพาะสถานะที่ให้",
    inputs: [text("projectName", "ชื่อโครงการ", true), text("reportingPeriod", "รอบรายงาน", true), area("objectives", "เป้าหมายโครงการ"), area("accomplishments", "ผลงานรอบนี้", true), area("milestones", "Milestone และสถานะ", true), area("risksIssues", "ความเสี่ยงและปัญหา"), area("decisions", "เรื่องที่ต้องตัดสินใจ"), area("nextPlan", "แผนรอบถัดไป")],
  },
  {
    id: "risk-register-builder", name: "Risk Register Builder", description: "เปลี่ยนข้อมูลโครงการเป็น Risk Register ที่มี Cause, Event, Impact, Control และ Owner",
    category: "finance-data-project", icon: "RSK", tags: ["Risk", "Register", "Governance"], featured: false, estimatedMinutes: 5, requiresFile: false,
    starterPrompt: "สร้างเว็บ Risk Register พร้อมคะแนน หลักฐาน Mitigation และ Owner", role: "Enterprise Risk Analyst",
    instructions: "สร้าง Risk Statement รูป Cause-Event-Impact พร้อม Category, Existing Control, Likelihood/Impact ตามข้อมูล, Early Warning, Treatment, Owner, Due Date และ Residual Risk หากข้อมูลไม่พอให้ระบุ Pending",
    inputs: [text("scopeName", "โครงการหรือขอบเขต", true), area("objectives", "วัตถุประสงค์", true), area("riskNotes", "ความเสี่ยงหรือเหตุการณ์ที่กังวล", true), area("existingControls", "มาตรการปัจจุบัน"), area("owners", "เจ้าของงานที่เกี่ยวข้อง"), select("priority", "ระดับเริ่มต้น", priorityOptions)],
  },
  {
    id: "data-quality-audit", name: "Data Quality Audit", description: "ตรวจโครงสร้างข้อมูล ความครบถ้วน ความสอดคล้อง ค่าผิดปกติ และความพร้อมใช้งาน",
    category: "finance-data-project", icon: "DQA", tags: ["Data Quality", "CSV", "Excel"], featured: true, estimatedMinutes: 7, requiresFile: true,
    starterPrompt: "สร้างเว็บ Data Quality Audit สำหรับ Excel และ CSV พร้อม Action Plan", role: "Data Quality Analyst",
    instructions: "ตรวจ Schema, Missing, Duplicate, Type, Format, Range, Outlier ที่สังเกตได้, Key, Date, Referential Clue, Bias/Truncation, Privacy Concern และ Readiness สร้าง Action Plan โดยไม่แก้ข้อมูลต้นฉบับ",
    fileField: "dataFile",
    inputs: [text("datasetName", "ชื่อชุดข้อมูล", true), area("intendedUse", "วัตถุประสงค์การใช้ข้อมูล", true), area("expectedSchema", "คอลัมน์หรือกฎที่คาดหวัง"), area("qualityRules", "กฎคุณภาพที่ต้องตรวจ"), upload("dataFile", "ไฟล์ข้อมูล", [".xlsx", ".csv", ".txt"], true)],
  },
];
