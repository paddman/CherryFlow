import { area, date, priorityOptions, select, text, upload, type TaskTemplateSpec } from "./shared.js";

export const itSecurityTemplateSpecs: TaskTemplateSpec[] = [
  {
    id: "it-incident-triage", name: "IT Incident Triage", description: "จัดระดับ Incident สรุปผลกระทบ สมมติฐาน หลักฐาน และแผนรับมือเบื้องต้น",
    category: "it-security", icon: "INC", tags: ["Incident", "ITSM", "Triage"], featured: true, estimatedMinutes: 4, requiresFile: false,
    starterPrompt: "สร้างเว็บ IT Incident Triage พร้อม Severity, Evidence, Owner และ Timeline", role: "IT Incident Manager",
    instructions: "สรุปอาการ เวลา ระบบที่กระทบ ผู้ใช้ ผลกระทบธุรกิจ ความรุนแรง หลักฐาน สมมติฐานที่ยังไม่ยืนยัน การควบคุมเบื้องต้น เจ้าของงาน การสื่อสาร และข้อมูลที่ต้องเก็บเพิ่ม ห้ามระบุ Root Cause หากยังไม่มีหลักฐาน",
    inputs: [text("incidentTitle", "ชื่อ Incident", true), date("detectedAt", "วันที่ตรวจพบ", true), area("symptoms", "อาการและ Alert", true), area("affectedServices", "ระบบหรือผู้ใช้ที่กระทบ", true), area("businessImpact", "ผลกระทบธุรกิจ"), area("evidence", "หลักฐานที่มี"), select("priority", "ความเร่งด่วน", priorityOptions)],
  },
  {
    id: "root-cause-analysis", name: "Root Cause Analysis", description: "สร้าง RCA แบบ Timeline, 5 Whys, Contributing Factors และ Corrective Actions",
    category: "it-security", icon: "RCA", tags: ["RCA", "5 Whys", "Postmortem"], featured: true, estimatedMinutes: 7, requiresFile: false,
    starterPrompt: "สร้างเว็บ Root Cause Analysis และ Post-Incident Review", role: "Site Reliability Engineer และ Problem Manager",
    instructions: "จัดทำ Incident Summary, Impact, Detection, Timeline, Confirmed Root Cause, Contributing Factors, What Went Well, What Failed, Corrective/Preventive Actions, Owner และ Due Date แยกข้อเท็จจริงจากสมมติฐาน",
    inputs: [text("incidentName", "ชื่อเหตุการณ์", true), area("impact", "ผลกระทบ", true), area("timeline", "Timeline", true), area("evidence", "หลักฐานและ Log ที่สรุปแล้ว", true), area("suspectedCauses", "สาเหตุที่สงสัย"), area("recovery", "การกู้คืนและเวลาที่ใช้")],
  },
  {
    id: "change-risk-assessment", name: "Change Risk Assessment", description: "ประเมินความเสี่ยง Change ก่อนใช้งานจริง พร้อม Test, Rollback และ Approval",
    category: "it-security", icon: "CHG", tags: ["Change", "Risk", "Rollback"], featured: false, estimatedMinutes: 5, requiresFile: false,
    starterPrompt: "สร้างเว็บประเมิน Change Risk พร้อม Test Plan และ Rollback Plan", role: "Change Manager",
    instructions: "ประเมิน Scope, Dependency, Blast Radius, Security, Data, Availability, Capacity, Test Evidence, Monitoring, Rollback Trigger, Rollback Steps, Communication, Approval และ Schedule Conflict โดยไม่รับรองความปลอดภัยแทนผู้อนุมัติ",
    inputs: [text("changeTitle", "ชื่อ Change", true), area("changeDescription", "รายละเอียดการเปลี่ยนแปลง", true), area("affectedSystems", "ระบบและ Dependency", true), area("testPlan", "Test Plan", true), area("rollbackPlan", "Rollback Plan", true), text("changeWindow", "ช่วงเวลาดำเนินการ"), area("knownRisks", "ความเสี่ยงที่ทราบ")],
  },
  {
    id: "cyber-alert-executive-summary", name: "Cyber Alert Executive Summary", description: "เปลี่ยน Alert เทคนิคเป็นสรุปผู้บริหารที่มีผลกระทบ หลักฐาน และ Decision Point",
    category: "it-security", icon: "SOC", tags: ["Cyber", "SOC", "Executive"], featured: true, estimatedMinutes: 4, requiresFile: true,
    starterPrompt: "สร้างเว็บสรุป Cyber Alert ภาษาไทยสำหรับผู้บริหารและ SOC", role: "Senior SOC Analyst และ Cyber Incident Communicator",
    instructions: "สรุป What Happened, Asset, Time, Evidence, Confidence, Potential Impact, Current Containment, Recommended Actions, Approval Needed และ Unknowns ใช้ถ้อยคำตามระดับความเชื่อมั่น ห้ามยืนยันการบุกรุกจาก Alert เดียว",
    fileField: "evidenceFile",
    inputs: [text("alertName", "ชื่อ Alert", true), text("asset", "Asset หรือระบบ", true), area("alertDetails", "รายละเอียด Alert", true), area("businessContext", "บริบทธุรกิจ"), upload("evidenceFile", "Log หรือ Evidence", [".txt", ".csv", ".xlsx", ".pdf"], true)],
  },
  {
    id: "vulnerability-remediation-plan", name: "Vulnerability Remediation Plan", description: "จัดลำดับแก้ช่องโหว่ตามความเสี่ยง Asset และข้อจำกัด พร้อม Validation Plan",
    category: "it-security", icon: "VULN", tags: ["Vulnerability", "Patch", "Risk"], featured: true, estimatedMinutes: 6, requiresFile: true,
    starterPrompt: "สร้างเว็บจัดลำดับ Vulnerability และวาง Remediation Plan", role: "Vulnerability Management Lead",
    instructions: "จัดกลุ่มช่องโหว่ตาม Asset, Severity, Exploitability ที่ปรากฏ, Exposure, Business Criticality, Dependency, Compensating Control, Owner, Target Date และ Validation Method ห้ามสร้างคะแนนหรือสถานะแพตช์ที่ไม่มีในข้อมูล",
    fileField: "scanFile",
    inputs: [text("assessmentName", "ชื่อรอบตรวจ", true), area("assetContext", "บริบท Asset และความสำคัญ", true), area("constraints", "ข้อจำกัดการ Patch"), upload("scanFile", "ผล Scan", [".csv", ".xlsx", ".pdf", ".txt"], true)],
  },
];
