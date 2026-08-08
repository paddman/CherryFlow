import { area, priorityOptions, select, text, toneOptions, type TaskTemplateSpec } from "./shared.js";

export const customerServiceTemplateSpecs: TaskTemplateSpec[] = [
  {
    id: "customer-complaint-triage", name: "Customer Complaint Triage", description: "จำแนกข้อร้องเรียน ความรุนแรง เจ้าของงาน SLA และข้อมูลที่ต้องขอเพิ่ม",
    category: "customer-service", icon: "CASE", tags: ["Complaint", "Triage", "SLA"], featured: true, estimatedMinutes: 3, requiresFile: false,
    starterPrompt: "สร้างเว็บคัดกรองข้อร้องเรียนลูกค้า พร้อม Priority, Owner และ Next Action", role: "Customer Service Triage Lead",
    instructions: "สรุปเหตุการณ์ ผลกระทบ ความเร่งด่วน ประเภท เคสซ้ำ ความเสี่ยง ข้อมูลที่ขาด เจ้าของงาน ขั้นตอนแรก และข้อความตอบรับ ห้ามยอมรับความผิดหรือสัญญาชดเชยแทนผู้มีอำนาจ",
    inputs: [text("caseId", "Case ID"), text("customer", "ลูกค้าหรือบัญชี", true), area("complaint", "รายละเอียดข้อร้องเรียน", true), area("impact", "ผลกระทบที่ลูกค้าแจ้ง"), select("reportedPriority", "ระดับที่แจ้งมา", priorityOptions), area("history", "ประวัติเคสที่เกี่ยวข้อง")],
  },
  {
    id: "service-recovery-response", name: "Service Recovery Response", description: "ร่างคำตอบกรณีบริการผิดพลาด พร้อมความรับผิดชอบ การแก้ไข และการติดตาม",
    category: "customer-service", icon: "REC", tags: ["Recovery", "Response", "Customer"], featured: true, estimatedMinutes: 3, requiresFile: false,
    starterPrompt: "สร้างเว็บร่าง Service Recovery Response โดยไม่สัญญาเกินอำนาจ", role: "Customer Experience Manager",
    instructions: "ร่างข้อความรับทราบ แสดงความเข้าใจ สรุปข้อเท็จจริงที่ยืนยันได้ การดำเนินการปัจจุบัน สิ่งที่จะอัปเดต เวลาอัปเดตที่ผู้ใช้ให้ และช่องทางติดต่อ ห้ามสร้างค่าชดเชยหรือ SLA",
    inputs: [text("customerName", "ชื่อลูกค้า"), area("issue", "ปัญหาที่เกิดขึ้น", true), area("verifiedFacts", "ข้อเท็จจริงที่ยืนยันแล้ว", true), area("actionsTaken", "สิ่งที่ดำเนินการแล้ว"), text("nextUpdate", "กำหนดอัปเดตครั้งถัดไป"), area("approvedRemedy", "แนวทางเยียวยาที่อนุมัติแล้ว"), select("tone", "น้ำเสียง", toneOptions)],
  },
  {
    id: "faq-knowledge-builder", name: "FAQ & Knowledge Article Builder", description: "เปลี่ยนความรู้กระจัดกระจายให้เป็น FAQ และบทความช่วยเหลือที่ค้นหาได้",
    category: "customer-service", icon: "KB", tags: ["FAQ", "Knowledge Base", "Support"], featured: false, estimatedMinutes: 5, requiresFile: false,
    starterPrompt: "สร้างเว็บช่วยเขียน FAQ และ Knowledge Article จากข้อมูลทีม Support", role: "Knowledge Management Specialist",
    instructions: "จัดทำชื่อบทความ กลุ่มผู้อ่าน อาการ สาเหตุ เงื่อนไขก่อนทำ ขั้นตอนแก้ วิธีตรวจผล ข้อควรระวัง การ Escalate และ FAQ ใช้คำที่ผู้ใช้ค้นหาได้ง่าย",
    inputs: [text("topic", "หัวข้อ", true), area("commonQuestions", "คำถามที่พบบ่อย", true), area("knownAnswers", "คำตอบหรือวิธีแก้ที่ยืนยันแล้ว", true), area("prerequisites", "เงื่อนไขก่อนดำเนินการ"), area("escalation", "กรณีที่ต้องส่งต่อ"), select("tone", "รูปแบบภาษา", toneOptions)],
  },
];
