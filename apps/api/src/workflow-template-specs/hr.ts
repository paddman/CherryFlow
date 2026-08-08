import { area, select, text, toneOptions, upload, type TaskTemplateSpec } from "./shared.js";

export const hrTemplateSpecs: TaskTemplateSpec[] = [
  {
    id: "job-description-writer", name: "Job Description Writer", description: "สร้าง JD ที่ชัดเจน ครบหน้าที่ คุณสมบัติ KPI และความสัมพันธ์ในองค์กร",
    category: "hr", icon: "JD", tags: ["HR", "Recruitment", "JD"], featured: true, estimatedMinutes: 4, requiresFile: false,
    starterPrompt: "สร้างเว็บเขียน Job Description พร้อม Responsibilities, Qualifications และ KPI", role: "HR Business Partner",
    instructions: "จัดทำ JD โดยมีวัตถุประสงค์ตำแหน่ง หน้าที่หลัก ผลลัพธ์ที่คาดหวัง KPI คุณสมบัติ ทักษะ ประสบการณ์ Reporting Line และคำถามที่ต้องยืนยัน หลีกเลี่ยงเงื่อนไขเลือกปฏิบัติ",
    inputs: [text("jobTitle", "ชื่อตำแหน่ง", true), text("department", "หน่วยงาน", true), area("jobPurpose", "วัตถุประสงค์ตำแหน่ง", true), area("responsibilities", "หน้าที่หลัก", true), area("qualifications", "คุณสมบัติ"), area("kpis", "KPI หรือผลลัพธ์"), select("tone", "รูปแบบภาษา", toneOptions)],
  },
  {
    id: "resume-screening-summary", name: "Resume Screening Summary", description: "สรุป Resume เทียบกับ JD พร้อมจุดตรง จุดขาด และคำถามสัมภาษณ์",
    category: "hr", icon: "CV", tags: ["Resume", "Screening", "Hiring"], featured: true, estimatedMinutes: 5, requiresFile: true,
    starterPrompt: "สร้างเว็บคัดกรอง Resume เทียบ JD พร้อมหลักฐานและคำถามสัมภาษณ์", role: "Recruitment Analyst",
    instructions: "เทียบ Resume กับเกณฑ์งานโดยอ้างหลักฐานจากเอกสาร แยก Match, Partial, Missing, Transferable Skills, Risk และคำถามสัมภาษณ์ ห้ามสรุปจากเพศ อายุ เชื้อชาติ ศาสนา รูปภาพ หรือข้อมูลอ่อนไหว",
    fileField: "resumeFile",
    inputs: [text("position", "ตำแหน่งที่สมัคร", true), area("jobRequirements", "ข้อกำหนดของงาน", true), area("mustHave", "Must-have criteria"), upload("resumeFile", "Resume หรือ CV", [".pdf", ".docx", ".txt"], true)],
  },
  {
    id: "interview-guide", name: "Structured Interview Guide", description: "สร้างชุดคำถามสัมภาษณ์แบบมีเกณฑ์ให้คะแนนและลดอคติ",
    category: "hr", icon: "INT", tags: ["Interview", "Scorecard", "HR"], featured: false, estimatedMinutes: 5, requiresFile: false,
    starterPrompt: "สร้างเว็บ Interview Guide พร้อมคำถาม Probes และ Scorecard", role: "Talent Acquisition Specialist",
    instructions: "สร้างคำถามตาม Competency แบบพฤติกรรม มี Follow-up, สัญญาณคำตอบที่ดี หลักฐานที่ควรหา และเกณฑ์คะแนน 1-5 หลีกเลี่ยงคำถามข้อมูลส่วนบุคคลที่ไม่เกี่ยวกับงาน",
    inputs: [text("position", "ตำแหน่ง", true), area("competencies", "Competency ที่ต้องประเมิน", true), area("jobChallenges", "ความท้าทายของงาน"), text("interviewDuration", "เวลาสัมภาษณ์"), area("mustAsk", "คำถามบังคับ")],
  },
  {
    id: "employee-onboarding-plan", name: "Employee Onboarding Plan", description: "สร้างแผน 30-60-90 วันพร้อมเจ้าของงาน การเรียนรู้ และ Checkpoint",
    category: "hr", icon: "ONB", tags: ["Onboarding", "30-60-90", "HR"], featured: true, estimatedMinutes: 5, requiresFile: false,
    starterPrompt: "สร้างเว็บแผน Onboarding 30-60-90 วันพร้อม Checklist", role: "People Operations Manager",
    instructions: "จัดทำ Preboarding, Day 1, Week 1, 30, 60, 90 วัน แยกระบบ บุคคล ความรู้ งานส่งมอบ เจ้าของกิจกรรม Checkpoint และเกณฑ์ผ่าน โดยไม่เดานโยบายองค์กร",
    inputs: [text("employeeName", "ชื่อพนักงาน"), text("position", "ตำแหน่ง", true), text("department", "หน่วยงาน", true), text("manager", "ผู้จัดการ"), area("firstProjects", "งานหรือโครงการแรก"), area("requiredSystems", "ระบบและสิทธิ์ที่ต้องใช้"), area("learningGoals", "เป้าหมายการเรียนรู้")],
  },
  {
    id: "performance-review-draft", name: "Performance Review Draft", description: "ร่างประเมินผลงานจากหลักฐาน แยกผลลัพธ์ จุดแข็ง ช่องว่าง และแผนพัฒนา",
    category: "hr", icon: "REV", tags: ["Performance", "Feedback", "Development"], featured: false, estimatedMinutes: 6, requiresFile: false,
    starterPrompt: "สร้างเว็บร่าง Performance Review ที่อ้างหลักฐานและมี Development Plan", role: "HR Business Partner และ Manager Coach",
    instructions: "สรุปผลงานเทียบเป้าหมายโดยใช้หลักฐาน แยก Impact, Strength, Gap, Context, Feedback และ Development Plan ใช้ภาษาตรงไปตรงมา ไม่ตัดสินบุคลิก และระบุสิ่งที่ไม่มีหลักฐาน",
    inputs: [text("employeeName", "ชื่อพนักงาน", true), text("reviewPeriod", "รอบประเมิน", true), area("goals", "เป้าหมายที่ตกลง", true), area("achievements", "ผลงานและหลักฐาน", true), area("challenges", "อุปสรรคหรือสิ่งที่ยังไม่สำเร็จ"), area("feedback", "Feedback จากผู้เกี่ยวข้อง"), select("tone", "น้ำเสียง", toneOptions)],
  },
];
