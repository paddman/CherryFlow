import { area, date, priorityOptions, select, text, toneOptions, type TaskTemplateSpec } from "./shared.js";

export const salesMarketingTemplateSpecs: TaskTemplateSpec[] = [
  {
    id: "sales-lead-qualifier", name: "Sales Lead Qualifier", description: "ประเมินคุณภาพ Lead สรุป Pain, Budget, Authority, Need, Timeline และ Next Move",
    category: "sales-marketing", icon: "LEAD", tags: ["Sales", "Lead", "BANT"], featured: true, estimatedMinutes: 3, requiresFile: false,
    starterPrompt: "สร้างเว็บคัดกรอง Sales Lead พร้อมคะแนน เหตุผล และ Next Action", role: "Sales Operations Analyst",
    instructions: "ประเมิน Lead ด้วยข้อมูลที่ให้ แยก Pain, Budget, Authority, Need, Timeline, Fit, Objection, Missing Information และ Next Best Action พร้อมระดับความพร้อมโดยไม่สร้างข้อมูลแทนลูกค้า",
    inputs: [text("company", "บริษัทหรือหน่วยงาน", true), text("contactRole", "บทบาทผู้ติดต่อ", true), area("customerNeed", "ความต้องการหรือ Pain Point", true), text("budget", "งบประมาณที่ทราบ"), text("timeline", "กรอบเวลา"), area("conversationNotes", "บันทึกการสนทนา"), select("priority", "ความสำคัญ", priorityOptions)],
  },
  {
    id: "customer-proposal-email", name: "Customer Proposal Email", description: "ร่างอีเมลเสนอขายที่สั้น ชัด และเชื่อม Pain ของลูกค้ากับคุณค่าที่เสนอ",
    category: "sales-marketing", icon: "MAIL", tags: ["Email", "Proposal", "Sales"], featured: true, estimatedMinutes: 3, requiresFile: false,
    starterPrompt: "สร้างเว็บร่างอีเมลเสนอขายแบบเฉพาะลูกค้า", role: "นักเขียนอีเมล B2B Sales",
    instructions: "เขียน Subject และอีเมลเสนอขายที่กล่าวถึงบริบทลูกค้า ปัญหา คุณค่า หลักฐานที่ผู้ใช้ให้ ข้อเสนอ ขั้นตอนถัดไป และ CTA หลีกเลี่ยงคำโฆษณาเกินจริง",
    inputs: [text("recipient", "ชื่อหรือบทบาทผู้รับ", true), text("company", "บริษัทลูกค้า", true), area("painPoint", "Pain Point", true), area("offer", "สินค้า บริการ หรือข้อเสนอ", true), area("proof", "หลักฐานหรือจุดเด่นที่ใช้ได้"), select("tone", "น้ำเสียง", toneOptions), text("callToAction", "สิ่งที่ต้องการให้ผู้รับทำ")],
  },
  {
    id: "marketing-campaign-plan", name: "Marketing Campaign Plan", description: "วางแผนแคมเปญตั้งแต่กลุ่มเป้าหมาย ข้อความ ช่องทาง งบ KPI และ Timeline",
    category: "sales-marketing", icon: "MKT", tags: ["Campaign", "Marketing", "KPI"], featured: true, estimatedMinutes: 6, requiresFile: false,
    starterPrompt: "สร้างเว็บวางแผน Marketing Campaign พร้อม Channel, Budget, KPI และ Timeline", role: "Marketing Strategist",
    instructions: "จัดทำแผนแคมเปญที่มี Objective, Audience, Insight, Value Proposition, Message, Channel, Content, Timeline, Budget ตามข้อมูลที่ให้ KPI, Experiment และ Risk",
    inputs: [text("campaignName", "ชื่อแคมเปญ", true), area("objective", "เป้าหมายธุรกิจ", true), area("audience", "กลุ่มเป้าหมาย", true), area("offer", "ข้อเสนอหรือสินค้า", true), text("budget", "งบประมาณ"), text("duration", "ระยะเวลา"), area("channels", "ช่องทางที่ต้องการใช้"), area("constraints", "ข้อจำกัด")],
  },
  {
    id: "content-calendar", name: "Content Calendar", description: "สร้างปฏิทินคอนเทนต์หลายช่องทางที่เชื่อมกับเป้าหมายและกลุ่มผู้ชม",
    category: "sales-marketing", icon: "CAL", tags: ["Content", "Calendar", "Social"], featured: false, estimatedMinutes: 5, requiresFile: false,
    starterPrompt: "สร้างเว็บ Content Calendar พร้อมหัวข้อ รูปแบบ ช่องทาง CTA และ KPI", role: "Content Strategist",
    instructions: "สร้างปฏิทินคอนเทนต์ที่ระบุวันที่หรือสัปดาห์ เสาหลักเนื้อหา หัวข้อ Hook รูปแบบ ช่องทาง CTA ผู้รับผิดชอบ และ KPI ให้กระจายเนื้อหาอย่างสมดุล",
    inputs: [text("brand", "แบรนด์หรือโครงการ", true), area("audience", "กลุ่มผู้ชม", true), area("contentGoals", "เป้าหมายเนื้อหา", true), area("channels", "ช่องทาง", true), text("period", "ช่วงเวลาที่ต้องการ", true), area("importantDates", "วันสำคัญหรือแคมเปญ"), select("tone", "น้ำเสียงแบรนด์", toneOptions)],
  },
  {
    id: "product-description-writer", name: "Product Description Writer", description: "เปลี่ยนข้อมูลสินค้าให้เป็นคำอธิบาย จุดขาย ข้อจำกัด และข้อความหลายช่องทาง",
    category: "sales-marketing", icon: "SKU", tags: ["Product", "Copywriting", "E-commerce"], featured: false, estimatedMinutes: 3, requiresFile: false,
    starterPrompt: "สร้างเว็บเขียน Product Description หลายช่องทางโดยไม่อวดอ้างเกินจริง", role: "Product Marketing Copywriter",
    instructions: "สร้างชื่อสินค้า คำอธิบายสั้น ฉบับเต็ม จุดเด่น ประโยชน์ กลุ่มเหมาะสม วิธีใช้ ข้อจำกัด SEO keywords และข้อความสำหรับ Social โดยใช้เฉพาะคุณสมบัติที่ได้รับ",
    inputs: [text("productName", "ชื่อสินค้า", true), area("features", "คุณสมบัติจริง", true), area("benefits", "ประโยชน์ที่พิสูจน์ได้"), area("targetCustomer", "กลุ่มลูกค้า", true), area("limitations", "ข้อจำกัดหรือคำเตือน"), select("tone", "น้ำเสียง", toneOptions)],
  },
  {
    id: "sales-call-follow-up", name: "Sales Call Follow-up", description: "สรุปการคุยขายและสร้างข้อความติดตามพร้อมข้อผูกพันของแต่ละฝ่าย",
    category: "sales-marketing", icon: "CALL", tags: ["Sales Call", "Follow-up", "CRM"], featured: false, estimatedMinutes: 3, requiresFile: false,
    starterPrompt: "สร้างเว็บสรุป Sales Call และร่าง Follow-up Email", role: "Account Executive Assistant",
    instructions: "สรุปบริบท ความต้องการ ประเด็นสนใจ ข้อกังวล สิ่งที่ตกลง เอกสารที่ต้องส่ง เจ้าของงาน กำหนดเวลา และร่างอีเมลติดตาม ห้ามสร้าง Commitment ที่ไม่ได้พูด",
    inputs: [text("accountName", "ชื่อลูกค้าหรือบัญชี", true), date("callDate", "วันที่สนทนา", true), area("attendees", "ผู้ร่วมสนทนา"), area("callNotes", "บันทึกการสนทนา", true), area("promisedItems", "สิ่งที่รับปากหรือขอเพิ่มเติม"), select("tone", "น้ำเสียงอีเมล", toneOptions)],
  },
];
