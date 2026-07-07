import { MarkerType } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';

export type StepKind = 'start' | 'task' | 'approval' | 'decision' | 'notification' | 'end';
export type StepStatus = 'draft' | 'ready' | 'running' | 'done';

export type LaneNodeData = Record<string, unknown> & {
  kind: 'lane';
  name: string;
  color: string;
};

export type StepNodeData = Record<string, unknown> & {
  kind: 'step';
  stepKind: StepKind;
  title: string;
  description: string;
  owner: string;
  laneId: string;
  slaHours: number;
  status: StepStatus;
  active: boolean;
  completed: boolean;
};

export type LaneFlowNode = Node<LaneNodeData, 'laneNode'>;
export type StepFlowNode = Node<StepNodeData, 'stepNode'>;
export type BuilderNode = LaneFlowNode | StepFlowNode;

export type SavedProcess = {
  version: 1;
  title: string;
  nodes: BuilderNode[];
  edges: Edge[];
};

export const LANE_WIDTH = 340;
export const LANE_HEIGHT = 1240;
export const LANE_GAP = 34;
export const STORAGE_KEY = 'cherryflow.process-builder.v1';
export const laneX = (index: number) => 40 + index * (LANE_WIDTH + LANE_GAP);

export const stepLabels: Record<StepKind, string> = {
  start: 'เริ่มต้น',
  task: 'งาน',
  approval: 'อนุมัติ',
  decision: 'เงื่อนไข',
  notification: 'แจ้งเตือน',
  end: 'สิ้นสุด',
};

export const statusLabels: Record<StepStatus, string> = {
  draft: 'Draft',
  ready: 'พร้อมทำงาน',
  running: 'กำลังดำเนินการ',
  done: 'เสร็จแล้ว',
};

export const palette: Array<{ kind: StepKind; label: string; detail: string }> = [
  { kind: 'start', label: 'Start', detail: 'จุดเริ่มต้นของกระบวนการ' },
  { kind: 'task', label: 'Task', detail: 'งานหรือกิจกรรมทั่วไป' },
  { kind: 'approval', label: 'Approval', detail: 'ขั้นตอนอนุมัติหรือรับรอง' },
  { kind: 'decision', label: 'Decision', detail: 'ตรวจสอบเงื่อนไขและแยกเส้นทาง' },
  { kind: 'notification', label: 'Notify', detail: 'ส่งอีเมล LINE หรือ Webhook' },
  { kind: 'end', label: 'End', detail: 'ปิดกระบวนการ' },
];

export function makeLane(id: string, name: string, index: number, color: string): LaneFlowNode {
  return {
    id,
    type: 'laneNode',
    position: { x: laneX(index), y: 40 },
    data: { kind: 'lane', name, color },
    draggable: false,
    selectable: false,
    connectable: false,
    zIndex: -1,
    style: { width: LANE_WIDTH, height: LANE_HEIGHT, pointerEvents: 'none' },
  };
}

export function makeStep(
  id: string,
  laneId: string,
  laneIndex: number,
  y: number,
  stepKind: StepKind,
  title: string,
  description: string,
  owner: string,
  slaHours = 0,
): StepFlowNode {
  return {
    id,
    type: 'stepNode',
    position: { x: laneX(laneIndex) + 42, y },
    data: {
      kind: 'step',
      stepKind,
      title,
      description,
      owner,
      laneId,
      slaHours,
      status: stepKind === 'start' ? 'ready' : 'draft',
      active: false,
      completed: false,
    },
    zIndex: 2,
  };
}

export function createTemplate(): SavedProcess {
  const nodes: BuilderNode[] = [
    makeLane('lane-requester', 'ฝ่ายงาน', 0, '#2563eb'),
    makeLane('lane-helpdesk', 'Helpdesk', 1, '#7c3aed'),
    makeLane('lane-support', 'Support', 2, '#0891b2'),
    makeStep('start', 'lane-requester', 0, 118, 'start', 'เริ่มขอใช้บริการ', 'เริ่มต้นคำขอเปิดใช้งาน NT Cloud Service', 'ฝ่ายงาน'),
    makeStep('request-form', 'lane-requester', 0, 240, 'task', 'กรอกข้อมูลคำขอ', 'กรอกข้อมูลบริการ Cloud Service ในใบเชื่อมโยง', 'ฝ่ายงาน', 2),
    makeStep('om-register', 'lane-requester', 0, 392, 'task', 'เปิดงานในระบบ OM', 'แนบเอกสารใบเชื่อมโยง ใบเสนอราคา และ Key ข้อมูลในระบบ OM', 'ฝ่ายงาน', 4),
    makeStep('helpdesk-form', 'lane-helpdesk', 1, 285, 'task', 'กรอกแบบฟอร์มเปิดบริการ', 'ตรวจสอบเอกสารและกรอกแบบฟอร์มการเปิดบริการ NT Cloud', 'Helpdesk', 4),
    makeStep('support-create-vm', 'lane-support', 2, 420, 'task', 'สร้าง VM ตามคำขอ', 'ดำเนินการสร้าง VM ตามข้อมูลในแบบฟอร์ม', 'Support', 8),
    makeStep('send-credential', 'lane-support', 2, 195, 'notification', 'แจ้งข้อมูลเข้าใช้งาน', 'ส่ง Username และ Password ไปยังอีเมลลูกค้า', 'Support', 1),
    makeStep('support-reply', 'lane-support', 2, 600, 'task', 'ตอบกลับผลการดำเนินการ', 'บันทึกผลและตอบกลับข้อมูลในแบบฟอร์มการเปิดบริการ', 'Support', 1),
    makeStep('helpdesk-check', 'lane-helpdesk', 1, 560, 'approval', 'ตรวจสอบข้อมูลการเปิดบริการ', 'ตรวจสอบความครบถ้วนของข้อมูลจาก Support', 'Helpdesk', 2),
    makeStep('helpdesk-reply', 'lane-helpdesk', 1, 722, 'notification', 'แจ้งผลกลับฝ่ายงาน', 'ตอบกลับข้อมูลในแบบฟอร์มใบเชื่อมโยง NT Cloud', 'Helpdesk', 1),
    makeStep('requester-test', 'lane-requester', 0, 660, 'approval', 'ทดสอบใช้งานลูกค้า', 'นำรายละเอียดไปใส่ใน OM เพื่อเรียกชำระเงินและทดสอบใช้งาน', 'ฝ่ายงาน', 8),
    makeStep('helpdesk-confirm', 'lane-helpdesk', 1, 868, 'approval', 'ตรวจสอบการเรียกชำระเงิน', 'ยืนยันว่าข้อมูลใน OM พร้อมสำหรับการเรียกเก็บค่าบริการ', 'Helpdesk', 2),
    makeStep('close-task', 'lane-helpdesk', 1, 994, 'task', 'ปิด Task งาน', 'บันทึกสถานะปิดงานและเก็บหลักฐานการดำเนินการ', 'Helpdesk', 1),
    makeStep('end', 'lane-helpdesk', 1, 1115, 'end', 'สิ้นสุดกระบวนการ', 'งานเปิดบริการเสร็จสมบูรณ์', 'Helpdesk'),
  ];

  const links: Array<[string, string]> = [
    ['start', 'request-form'],
    ['request-form', 'om-register'],
    ['om-register', 'helpdesk-form'],
    ['helpdesk-form', 'support-create-vm'],
    ['support-create-vm', 'send-credential'],
    ['send-credential', 'support-reply'],
    ['support-reply', 'helpdesk-check'],
    ['helpdesk-check', 'helpdesk-reply'],
    ['helpdesk-reply', 'requester-test'],
    ['requester-test', 'helpdesk-confirm'],
    ['helpdesk-confirm', 'close-task'],
    ['close-task', 'end'],
  ];

  return {
    version: 1,
    title: 'ขั้นตอนการเปิดใช้งานบริการ NT Cloud Service',
    nodes,
    edges: links.map(([source, target], index) => ({
      id: `edge-${index + 1}`,
      source,
      target,
      markerEnd: { type: MarkerType.ArrowClosed },
    })),
  };
}

export function isLaneNode(node: BuilderNode): node is LaneFlowNode {
  return node.type === 'laneNode' && node.data.kind === 'lane';
}

export function isStepNode(node: BuilderNode): node is StepFlowNode {
  return node.type === 'stepNode' && node.data.kind === 'step';
}

export function topologicalOrder(nodes: StepFlowNode[], edges: Edge[]): string[] {
  const ids = new Set(nodes.map((node) => node.id));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));

  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  }

  const queue = nodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .sort((a, b) => (a.data.stepKind === 'start' ? -1 : b.data.stepKind === 'start' ? 1 : a.position.y - b.position.y))
    .map((node) => node.id);
  const result: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) break;
    result.push(id);
    for (const target of outgoing.get(id) ?? []) {
      const next = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, next);
      if (next === 0) queue.push(target);
    }
  }
  return result;
}

export function validateProcess(nodes: StepFlowNode[], edges: Edge[]): string[] {
  const errors: string[] = [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (!nodes.some((node) => node.data.stepKind === 'start')) errors.push('ต้องมี Start อย่างน้อย 1 จุด');
  if (!nodes.some((node) => node.data.stepKind === 'end')) errors.push('ต้องมี End อย่างน้อย 1 จุด');

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) errors.push(`พบเส้นเชื่อมที่อ้างถึง Node ที่ไม่มีอยู่: ${edge.id}`);
    if (edge.source === edge.target) errors.push(`Node ${edge.source} เชื่อมกลับเข้าตัวเอง`);
  }

  for (const node of nodes) {
    const incoming = edges.some((edge) => edge.target === node.id);
    const outgoing = edges.some((edge) => edge.source === node.id);
    if (node.data.stepKind !== 'start' && !incoming) errors.push(`“${node.data.title}” ไม่มีเส้นทางเข้า`);
    if (node.data.stepKind !== 'end' && !outgoing) errors.push(`“${node.data.title}” ไม่มีเส้นทางออก`);
  }

  if (nodes.length > 0 && topologicalOrder(nodes, edges).length !== nodes.length) errors.push('Flow มีวงจรหรือเส้นทางที่ประมวลผลไม่ได้');
  return [...new Set(errors)];
}
