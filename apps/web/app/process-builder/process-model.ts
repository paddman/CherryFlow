import { MarkerType } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';

export type StepKind = 'start' | 'task' | 'approval' | 'decision' | 'notification' | 'end';
export type StepStatus = 'draft' | 'ready' | 'running' | 'done';
export type SwimlaneLayoutPreset = 'horizontal' | 'vertical' | 'compact' | 'document' | 'kanban' | 'timeline';
export type ShadowDensity = 'none' | 'soft' | 'strong';

export type SwimlaneTheme = {
  backgroundColor: string;
  lineColor: string;
  radius: number;
  shadowDensity: ShadowDensity;
};

export type SwimlaneConfig = {
  layoutPreset: SwimlaneLayoutPreset;
  laneWidth: number;
  laneHeight: number;
  laneGap: number;
  stepSpacing: number;
  showGrid: boolean;
  showMinimap: boolean;
  showEdgeLabels: boolean;
  theme: SwimlaneTheme;
};

export type LaneNodeData = Record<string, unknown> & {
  kind: 'lane';
  name: string;
  color: string;
};

export type StepNodeData = Record<string, unknown> & {
  kind: 'step';
  stepKind: StepKind;
  referenceCode?: string;
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
  version: 2;
  title: string;
  swimlaneConfig: SwimlaneConfig;
  nodes: BuilderNode[];
  edges: Edge[];
};

export const STORAGE_KEY = 'cherryflow.process-builder.v2';
export const CANVAS_ORIGIN = 40;
export const LANE_HEADER_HEIGHT = 55;
export const STEP_INSET = 42;
export const DEFAULT_STEP_WIDTH = 256;

const layoutPresets: Record<SwimlaneLayoutPreset, SwimlaneConfig> = {
  horizontal: {
    layoutPreset: 'horizontal',
    laneWidth: 340,
    laneHeight: 1240,
    laneGap: 34,
    stepSpacing: 140,
    showGrid: true,
    showMinimap: true,
    showEdgeLabels: true,
    theme: { backgroundColor: '#f7f9fc', lineColor: '#64748b', radius: 15, shadowDensity: 'soft' },
  },
  vertical: {
    layoutPreset: 'vertical',
    laneWidth: 1180,
    laneHeight: 330,
    laneGap: 34,
    stepSpacing: 292,
    showGrid: true,
    showMinimap: true,
    showEdgeLabels: true,
    theme: { backgroundColor: '#f8fafc', lineColor: '#475569', radius: 15, shadowDensity: 'soft' },
  },
  compact: {
    layoutPreset: 'compact',
    laneWidth: 286,
    laneHeight: 940,
    laneGap: 22,
    stepSpacing: 110,
    showGrid: true,
    showMinimap: false,
    showEdgeLabels: false,
    theme: { backgroundColor: '#f8fafc', lineColor: '#94a3b8', radius: 12, shadowDensity: 'none' },
  },
  document: {
    layoutPreset: 'document',
    laneWidth: 1120,
    laneHeight: 360,
    laneGap: 26,
    stepSpacing: 304,
    showGrid: false,
    showMinimap: false,
    showEdgeLabels: true,
    theme: { backgroundColor: '#fffdf7', lineColor: '#8a6f3f', radius: 10, shadowDensity: 'soft' },
  },
  kanban: {
    layoutPreset: 'kanban',
    laneWidth: 320,
    laneHeight: 880,
    laneGap: 22,
    stepSpacing: 124,
    showGrid: false,
    showMinimap: true,
    showEdgeLabels: false,
    theme: { backgroundColor: '#f1f5f9', lineColor: '#64748b', radius: 18, shadowDensity: 'strong' },
  },
  timeline: {
    layoutPreset: 'timeline',
    laneWidth: 1220,
    laneHeight: 300,
    laneGap: 20,
    stepSpacing: 292,
    showGrid: true,
    showMinimap: true,
    showEdgeLabels: true,
    theme: { backgroundColor: '#f8fbff', lineColor: '#2563eb', radius: 999, shadowDensity: 'soft' },
  },
};

export const swimlanePresets = Object.keys(layoutPresets) as SwimlaneLayoutPreset[];
export const DEFAULT_SWIMLANE_CONFIG = layoutPresets.horizontal;

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function colorValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export function swimlaneConfigForPreset(preset: SwimlaneLayoutPreset): SwimlaneConfig {
  return structuredClone(layoutPresets[preset]);
}

export function normalizeSwimlaneConfig(value: unknown, fallbackPreset: SwimlaneLayoutPreset = 'horizontal'): SwimlaneConfig {
  const raw = (value && typeof value === 'object' && !Array.isArray(value)) ? value as Record<string, unknown> : {};
  const requestedPreset = raw.layoutPreset;
  if (requestedPreset !== undefined && !swimlanePresets.includes(requestedPreset as SwimlaneLayoutPreset)) {
    throw new Error(`Unknown swimlane preset: ${String(requestedPreset)}`);
  }
  const preset = (requestedPreset as SwimlaneLayoutPreset | undefined) ?? fallbackPreset;
  const base = swimlaneConfigForPreset(preset);
  const rawTheme = (raw.theme && typeof raw.theme === 'object' && !Array.isArray(raw.theme)) ? raw.theme as Record<string, unknown> : {};
  const shadowDensity = rawTheme.shadowDensity;
  return {
    layoutPreset: preset,
    laneWidth: clampNumber(raw.laneWidth, base.laneWidth, 240, 1600),
    laneHeight: clampNumber(raw.laneHeight, base.laneHeight, 220, 1800),
    laneGap: clampNumber(raw.laneGap, base.laneGap, 8, 160),
    stepSpacing: clampNumber(raw.stepSpacing, base.stepSpacing, 72, 420),
    showGrid: booleanValue(raw.showGrid, base.showGrid),
    showMinimap: booleanValue(raw.showMinimap, base.showMinimap),
    showEdgeLabels: booleanValue(raw.showEdgeLabels, base.showEdgeLabels),
    theme: {
      backgroundColor: colorValue(rawTheme.backgroundColor, base.theme.backgroundColor),
      lineColor: colorValue(rawTheme.lineColor, base.theme.lineColor),
      radius: clampNumber(rawTheme.radius, base.theme.radius, 0, 999),
      shadowDensity: shadowDensity === 'none' || shadowDensity === 'soft' || shadowDensity === 'strong' ? shadowDensity : base.theme.shadowDensity,
    },
  };
}

export function isRowPreset(config: SwimlaneConfig): boolean {
  return config.layoutPreset === 'vertical' || config.layoutPreset === 'document' || config.layoutPreset === 'timeline';
}

export function lanePosition(index: number, config: SwimlaneConfig) {
  return isRowPreset(config)
    ? { x: CANVAS_ORIGIN, y: CANVAS_ORIGIN + index * (config.laneHeight + config.laneGap) }
    : { x: CANVAS_ORIGIN + index * (config.laneWidth + config.laneGap), y: CANVAS_ORIGIN };
}

export function stepPosition(laneIndex: number, stepIndex: number, config: SwimlaneConfig) {
  const lane = lanePosition(laneIndex, config);
  return isRowPreset(config)
    ? { x: lane.x + STEP_INSET + stepIndex * config.stepSpacing, y: lane.y + LANE_HEADER_HEIGHT + 36 }
    : { x: lane.x + STEP_INSET, y: lane.y + LANE_HEADER_HEIGHT + 40 + stepIndex * config.stepSpacing };
}

export function laneStyle(config: SwimlaneConfig) {
  return { width: config.laneWidth, height: config.laneHeight, pointerEvents: 'none' as const };
}

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

export function makeLane(id: string, name: string, index: number, color: string, config = DEFAULT_SWIMLANE_CONFIG): LaneFlowNode {
  return {
    id,
    type: 'laneNode',
    position: lanePosition(index, config),
    data: { kind: 'lane', name, color },
    draggable: false,
    selectable: false,
    connectable: false,
    zIndex: -1,
    style: laneStyle(config),
  };
}

export function makeStep(
  id: string,
  laneId: string,
  laneIndex: number,
  stepIndex: number,
  stepKind: StepKind,
  title: string,
  description: string,
  owner: string,
  slaHours = 0,
  referenceCode = '',
  config = DEFAULT_SWIMLANE_CONFIG,
): StepFlowNode {
  return {
    id,
    type: 'stepNode',
    position: stepPosition(laneIndex, stepIndex, config),
    data: {
      kind: 'step',
      stepKind,
      referenceCode,
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
  const swimlaneConfig = swimlaneConfigForPreset('horizontal');
  const nodes: BuilderNode[] = [
    makeLane('lane-requester', 'ฝ่ายงาน', 0, '#2563eb', swimlaneConfig),
    makeLane('lane-helpdesk', 'Helpdesk', 1, '#059669', swimlaneConfig),
    makeLane('lane-support', 'Support', 2, '#ea580c', swimlaneConfig),
    makeStep('start', 'lane-requester', 0, 0, 'start', 'START', 'เริ่มต้นคำขอเปิดใช้งาน NT Cloud Service', 'ฝ่ายงาน', 0, '', swimlaneConfig),
    makeStep('request-form', 'lane-requester', 0, 1, 'task', 'กรอกข้อมูลคำขอใช้บริการ', 'กรอกแบบฟอร์ม NT Cloud Service ตามลิงก์ที่กำหนด', 'ฝ่ายงาน', 2, '1', swimlaneConfig),
    makeStep('om-register', 'lane-requester', 0, 2, 'task', 'ส่งเอกสารและรายละเอียด', 'แนบเอกสารใบเชื่อมโยง ใบเสนอราคา และ Key เข้าสู่ระบบ OM', 'ฝ่ายงาน', 4, '2', swimlaneConfig),
    makeStep('requester-om-billing', 'lane-requester', 0, 3, 'task', 'บันทึกรายละเอียดใน OM', 'นำข้อมูลที่ได้รับไปใส่ในระบบ OM เพื่อเรียกชำระเงินลูกค้า', 'ฝ่ายงาน', 4, '10', swimlaneConfig),
    makeStep('helpdesk-form', 'lane-helpdesk', 1, 0, 'task', 'กรอกแบบฟอร์มเปิดบริการ', 'บันทึกข้อมูลในแบบฟอร์มการเปิดบริการ NT Cloud', 'Helpdesk', 4, '4', swimlaneConfig),
    makeStep('helpdesk-check-docs', 'lane-helpdesk', 1, 1, 'approval', 'ตรวจสอบเอกสาร', 'ตรวจสอบข้อมูลเอกสาร ใบเชื่อมโยง และใบเสนอราคา', 'Helpdesk', 2, '3', swimlaneConfig),
    makeStep('helpdesk-check', 'lane-helpdesk', 1, 2, 'approval', 'ตรวจสอบผลจาก Support', 'ตรวจสอบความครบถ้วนของข้อมูลในแบบฟอร์ม', 'Helpdesk', 2, '8', swimlaneConfig),
    makeStep('helpdesk-reply', 'lane-helpdesk', 1, 3, 'notification', 'ตอบกลับข้อมูลให้ฝ่ายงาน', 'ส่งรายละเอียดผ่านอีเมลหรือลิงก์ NT Cloud', 'Helpdesk', 1, '9', swimlaneConfig),
    makeStep('helpdesk-confirm', 'lane-helpdesk', 1, 4, 'approval', 'ตรวจสอบการเรียกชำระเงิน', 'ยืนยันว่าระบบ OM ดำเนินการครบถ้วน', 'Helpdesk', 2, '11', swimlaneConfig),
    makeStep('close-task', 'lane-helpdesk', 1, 5, 'task', 'ปิด Task งาน', 'สรุปผลและปิดงานในระบบ', 'Helpdesk', 1, '12', swimlaneConfig),
    makeStep('end', 'lane-helpdesk', 1, 6, 'end', 'END', 'งานเปิดบริการเสร็จสมบูรณ์', 'Helpdesk', 0, '', swimlaneConfig),
    makeStep('send-credential', 'lane-support', 2, 0, 'notification', 'แจ้งข้อมูลเข้าใช้งาน', 'ส่ง Username และ Password ไปยังอีเมลลูกค้า', 'Support', 1, '6', swimlaneConfig),
    makeStep('support-create-vm', 'lane-support', 2, 1, 'task', 'สร้าง VM', 'ดำเนินการสร้าง VM ตามข้อมูลในแบบฟอร์ม', 'Support', 8, '5', swimlaneConfig),
    makeStep('support-reply', 'lane-support', 2, 2, 'task', 'ตอบกลับผลการดำเนินงาน', 'อัปเดตข้อมูลในแบบฟอร์มการเปิดบริการ NT Cloud', 'Support', 1, '7', swimlaneConfig),
  ];

  const links: Array<[string, string, string?]> = [
    ['start', 'request-form'],
    ['request-form', 'om-register'],
    ['om-register', 'helpdesk-check-docs', 'ส่งข้อมูลไปที่ ntcloud@ntplc.co.th'],
    ['helpdesk-check-docs', 'helpdesk-form'],
    ['helpdesk-form', 'support-create-vm', 'แจ้งเปิดงานผ่าน support_cloud@ntplc.cloud'],
    ['support-create-vm', 'send-credential'],
    ['send-credential', 'support-reply'],
    ['support-reply', 'helpdesk-check'],
    ['helpdesk-check', 'helpdesk-reply'],
    ['helpdesk-reply', 'requester-om-billing'],
    ['requester-om-billing', 'helpdesk-confirm'],
    ['helpdesk-confirm', 'close-task'],
    ['close-task', 'end'],
  ];

  return {
    version: 2,
    title: 'ขั้นตอนการเปิดใช้งานบริการ NT Cloud Service',
    swimlaneConfig,
    nodes,
    edges: links.map(([source, target, label], index) => ({
      id: `edge-${index + 1}`,
      source,
      target,
      label,
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

export function sortLanes(lanes: LaneFlowNode[], config: SwimlaneConfig): LaneFlowNode[] {
  return lanes.slice().sort((a, b) => isRowPreset(config) ? a.position.y - b.position.y : a.position.x - b.position.x);
}

export function stepSortValue(node: StepFlowNode, config: SwimlaneConfig): number {
  return isRowPreset(config) ? node.position.x : node.position.y;
}

export function applySwimlaneLayout(nodes: BuilderNode[], config: SwimlaneConfig): BuilderNode[] {
  const lanes = sortLanes(nodes.filter(isLaneNode), config);
  const laneIndex = new Map(lanes.map((lane, index) => [lane.id, index]));
  const stepsByLane = new Map<string, StepFlowNode[]>();
  for (const step of nodes.filter(isStepNode)) {
    const list = stepsByLane.get(step.data.laneId) ?? [];
    list.push(step);
    stepsByLane.set(step.data.laneId, list);
  }
  const stepIndex = new Map<string, number>();
  for (const [laneId, laneSteps] of stepsByLane.entries()) {
    laneSteps
      .slice()
      .sort((a, b) => stepSortValue(a, config) - stepSortValue(b, config))
      .forEach((step, index) => stepIndex.set(step.id, index));
    if (!laneIndex.has(laneId)) laneIndex.set(laneId, laneIndex.size);
  }

  return nodes.map((node) => {
    if (isLaneNode(node)) {
      const index = laneIndex.get(node.id) ?? 0;
      return { ...node, position: lanePosition(index, config), style: laneStyle(config) };
    }
    if (isStepNode(node)) {
      const index = laneIndex.get(node.data.laneId) ?? 0;
      return { ...node, position: stepPosition(index, stepIndex.get(node.id) ?? 0, config) };
    }
    return node;
  });
}

export function normalizeSavedProcess(value: unknown): SavedProcess {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
  if (raw.version !== 1 && raw.version !== 2) throw new Error('รองรับเฉพาะ Flow JSON version 1 หรือ 2');
  const swimlaneConfig = normalizeSwimlaneConfig(raw.swimlaneConfig);
  const nodes = applySwimlaneLayout(raw.nodes as BuilderNode[], swimlaneConfig).map((node) => isStepNode(node)
    ? { ...node, data: { ...node.data, active: false, completed: false } }
    : node);
  return {
    version: 2,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'Imported Process',
    swimlaneConfig,
    nodes,
    edges: raw.edges as Edge[],
  };
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
