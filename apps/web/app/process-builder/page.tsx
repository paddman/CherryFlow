'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import type { Connection, Edge, NodeMouseHandler, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './process-builder.css';

import { AuthGate } from '../../components/AuthGate';
import {
  LANE_HEIGHT,
  STORAGE_KEY,
  createTemplate,
  isLaneNode,
  isStepNode,
  laneX,
  makeLane,
  makeStep,
  palette,
  statusLabels,
  stepLabels,
  topologicalOrder,
  validateProcess,
  type BuilderNode,
  type LaneFlowNode,
  type SavedProcess,
  type StepFlowNode,
  type StepKind,
  type StepNodeData,
  type StepStatus,
} from './process-model';

function LaneCard({ data }: NodeProps<LaneFlowNode>) {
  return (
    <section className="processLane" style={{ '--lane-color': data.color } as CSSProperties}>
      <header><span className="laneDot" /><strong>{data.name}</strong></header>
      <div className="laneBody" />
    </section>
  );
}

function StepCard({ data, selected }: NodeProps<StepFlowNode>) {
  return (
    <article className={`processStep processStep-${data.stepKind}${selected ? ' selected' : ''}${data.active ? ' active' : ''}${data.completed ? ' completed' : ''}`}>
      {data.stepKind !== 'start' && <Handle type="target" position={Position.Top} />}
      <div className="stepTopline">
        <span className="stepType">{stepLabels[data.stepKind]}</span>
        <span className={`stepStatus stepStatus-${data.status}`}>{statusLabels[data.status]}</span>
      </div>
      <strong>{data.title}</strong>
      {data.description && <p>{data.description}</p>}
      <footer>
        <span>{data.owner || 'ยังไม่กำหนดผู้รับผิดชอบ'}</span>
        <span>{data.slaHours > 0 ? `SLA ${data.slaHours} ชม.` : 'ไม่กำหนด SLA'}</span>
      </footer>
      {data.stepKind !== 'end' && <Handle type="source" position={Position.Bottom} />}
    </article>
  );
}

const nodeTypes = { laneNode: LaneCard, stepNode: StepCard };
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function ProcessBuilderWorkspace() {
  const template = useMemo(createTemplate, []);
  const [title, setTitle] = useState(template.title);
  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderNode>(template.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(template.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeLaneId, setActiveLaneId] = useState('lane-requester');
  const [notice, setNotice] = useState('โหลดตัวอย่าง NT Cloud Service แล้ว');
  const [running, setRunning] = useState(false);
  const importRef = useRef<HTMLInputElement | null>(null);

  const lanes = useMemo(() => nodes.filter(isLaneNode).sort((a, b) => a.position.x - b.position.x), [nodes]);
  const steps = useMemo(() => nodes.filter(isStepNode), [nodes]);
  const selectedStep = useMemo(() => steps.find((node) => node.id === selectedNodeId) ?? null, [selectedNodeId, steps]);
  const validationErrors = useMemo(() => validateProcess(steps, edges), [edges, steps]);
  const estimatedHours = useMemo(() => steps.reduce((sum, node) => sum + node.data.slaHours, 0), [steps]);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as SavedProcess;
      if (parsed.version === 1 && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        setTitle(parsed.title || template.title);
        setNodes(parsed.nodes.map((node) => isStepNode(node) ? { ...node, data: { ...node.data, active: false } } : node));
        setEdges(parsed.edges);
        setNotice('กู้คืน Flow ล่าสุดจากเครื่องนี้แล้ว');
      }
    } catch {
      setNotice('พบข้อมูล Flow เดิม แต่ไม่สามารถอ่านได้');
    }
  }, [setEdges, setNodes, template.title]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    setEdges((current) => addEdge({ ...connection, markerEnd: { type: MarkerType.ArrowClosed } }, current));
  }, [setEdges]);

  const onNodeClick: NodeMouseHandler<BuilderNode> = useCallback((_event, node) => {
    if (!isStepNode(node)) return;
    setSelectedNodeId(node.id);
    setActiveLaneId(node.data.laneId);
  }, []);

  const addStep = useCallback((stepKind: StepKind) => {
    const lane = lanes.find((item) => item.id === activeLaneId) ?? lanes[0];
    if (!lane) return;
    const laneIndex = Math.max(0, lanes.findIndex((item) => item.id === lane.id));
    const laneSteps = steps.filter((node) => node.data.laneId === lane.id);
    const maxY = laneSteps.reduce((value, node) => Math.max(value, node.position.y), 110);
    const id = `${stepKind}-${crypto.randomUUID().slice(0, 8)}`;
    const newNode = makeStep(
      id,
      lane.id,
      laneIndex,
      Math.min(maxY + 150, LANE_HEIGHT - 100),
      stepKind,
      `ขั้นตอนใหม่: ${stepLabels[stepKind]}`,
      '',
      lane.data.name,
      stepKind === 'task' || stepKind === 'approval' ? 4 : 0,
    );
    setNodes((current) => [...current, newNode]);
    setSelectedNodeId(id);
    setNotice(`เพิ่ม ${stepLabels[stepKind]} ใน Lane ${lane.data.name} แล้ว`);
  }, [activeLaneId, lanes, setNodes, steps]);

  const addLane = useCallback(() => {
    const id = `lane-${crypto.randomUUID().slice(0, 8)}`;
    const colors = ['#ea580c', '#16a34a', '#db2777', '#4f46e5'];
    const lane = makeLane(id, `หน่วยงาน ${lanes.length + 1}`, lanes.length, colors[lanes.length % colors.length] ?? '#2563eb');
    setNodes((current) => [...current, lane]);
    setActiveLaneId(id);
    setNotice('เพิ่ม Swimlane ใหม่แล้ว');
  }, [lanes.length, setNodes]);

  const renameLane = useCallback((laneId: string, name: string) => {
    setNodes((current) => current.map((node) => isLaneNode(node) && node.id === laneId
      ? { ...node, data: { ...node.data, name } }
      : node));
  }, [setNodes]);

  const deleteLane = useCallback((laneId: string) => {
    if (steps.some((node) => node.data.laneId === laneId)) {
      setNotice('ย้ายหรือลบขั้นตอนใน Lane นี้ก่อน');
      return;
    }
    if (lanes.length <= 1) {
      setNotice('Flow ต้องมีอย่างน้อย 1 Lane');
      return;
    }
    const remaining = lanes.filter((lane) => lane.id !== laneId);
    const nextX = new Map(remaining.map((lane, index) => [lane.id, laneX(index)]));
    setNodes((current) => current
      .filter((node) => node.id !== laneId)
      .map((node) => {
        if (isLaneNode(node)) return { ...node, position: { ...node.position, x: nextX.get(node.id) ?? node.position.x } };
        const assignedX = nextX.get(node.data.laneId);
        return assignedX === undefined ? node : { ...node, position: { ...node.position, x: assignedX + 42 } };
      }));
    const nextLane = remaining[0];
    if (nextLane) setActiveLaneId(nextLane.id);
    setNotice('ลบ Lane แล้ว');
  }, [lanes, setNodes, steps]);

  const updateSelected = useCallback((patch: Partial<StepNodeData>) => {
    if (!selectedNodeId) return;
    setNodes((current) => current.map((node) => isStepNode(node) && node.id === selectedNodeId
      ? { ...node, data: { ...node.data, ...patch } }
      : node));
  }, [selectedNodeId, setNodes]);

  const moveSelectedToLane = useCallback((laneId: string) => {
    if (!selectedNodeId) return;
    const lane = lanes.find((item) => item.id === laneId);
    if (!lane) return;
    setNodes((current) => current.map((node) => isStepNode(node) && node.id === selectedNodeId
      ? { ...node, position: { ...node.position, x: lane.position.x + 42 }, data: { ...node.data, laneId } }
      : node));
    setActiveLaneId(laneId);
  }, [lanes, selectedNodeId, setNodes]);

  const deleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((current) => current.filter((node) => node.id !== selectedNodeId));
    setEdges((current) => current.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
    setSelectedNodeId(null);
    setNotice('ลบขั้นตอนและเส้นเชื่อมที่เกี่ยวข้องแล้ว');
  }, [selectedNodeId, setEdges, setNodes]);

  const save = useCallback(() => {
    const payload: SavedProcess = { version: 1, title, nodes, edges };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setNotice(`บันทึก Flow แล้ว · ${new Date().toLocaleTimeString('th-TH')}`);
  }, [edges, nodes, title]);

  const resetTemplate = useCallback(() => {
    const fresh = createTemplate();
    setTitle(fresh.title);
    setNodes(fresh.nodes);
    setEdges(fresh.edges);
    setSelectedNodeId(null);
    setActiveLaneId('lane-requester');
    setNotice('คืนค่า Template NT Cloud Service แล้ว');
  }, [setEdges, setNodes]);

  const exportFlow = useCallback(() => {
    const payload: SavedProcess = { version: 1, title, nodes, edges };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9ก-๙]+/gi, '-').replace(/^-|-$/g, '') || 'cherryflow-process'}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Export Flow เป็น JSON แล้ว');
  }, [edges, nodes, title]);

  const importFlow = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as SavedProcess;
      if (parsed.version !== 1 || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
      setTitle(parsed.title || 'Imported Process');
      setNodes(parsed.nodes.map((node) => isStepNode(node) ? { ...node, data: { ...node.data, active: false, completed: false } } : node));
      setEdges(parsed.edges);
      setSelectedNodeId(null);
      const firstLane = parsed.nodes.find(isLaneNode);
      if (firstLane) setActiveLaneId(firstLane.id);
      setNotice(`นำเข้า ${file.name} สำเร็จ`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'นำเข้า Flow ไม่สำเร็จ');
    }
  }, [setEdges, setNodes]);

  const runSimulation = useCallback(async () => {
    if (validationErrors.length > 0 || running) return;
    const order = topologicalOrder(steps, edges);
    setRunning(true);
    setSelectedNodeId(null);
    setNodes((current) => current.map((node) => isStepNode(node)
      ? { ...node, data: { ...node.data, active: false, completed: false } }
      : node));
    setNotice('กำลังจำลองการทำงานของ Flow...');

    for (const nodeId of order) {
      setNodes((current) => current.map((node) => isStepNode(node)
        ? { ...node, data: { ...node.data, active: node.id === nodeId } }
        : node));
      await wait(520);
      setNodes((current) => current.map((node) => isStepNode(node) && node.id === nodeId
        ? { ...node, data: { ...node.data, active: false, completed: true } }
        : node));
    }
    setRunning(false);
    setNotice('จำลอง Flow เสร็จแล้ว');
  }, [edges, running, setNodes, steps, validationErrors.length]);

  return (
    <div className="processBuilderPage">
      <aside className="processSidebar">
        <div className="processBrand"><span className="processBrandMark">C</span><div><strong>CherryFlow</strong><small>Business Process Builder</small></div></div>
        <section className="sidebarSection">
          <div className="sidebarHeading"><span>SWIMLANES</span><button type="button" onClick={addLane}>＋</button></div>
          <div className="laneList">
            {lanes.map((lane) => (
              <article className={activeLaneId === lane.id ? 'laneListItem active' : 'laneListItem'} key={lane.id}>
                <button type="button" className="laneSelect" onClick={() => setActiveLaneId(lane.id)}><span style={{ background: lane.data.color }} /></button>
                <input value={lane.data.name} onChange={(event: ChangeEvent<HTMLInputElement>) => renameLane(lane.id, event.target.value)} aria-label={`ชื่อ Lane ${lane.data.name}`} />
                <button type="button" className="laneDelete" onClick={() => deleteLane(lane.id)} aria-label={`ลบ Lane ${lane.data.name}`}>×</button>
              </article>
            ))}
          </div>
        </section>
        <section className="sidebarSection">
          <div className="sidebarHeading"><span>COMPONENTS</span></div>
          <div className="componentList">
            {palette.map((item) => (
              <button type="button" key={item.kind} onClick={() => addStep(item.kind)}>
                <span className={`componentIcon componentIcon-${item.kind}`}>{item.label.slice(0, 2)}</span>
                <span><strong>{item.label}</strong><small>{item.detail}</small></span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <main className="processWorkspace">
        <header className="processToolbar">
          <div className="processTitleBlock">
            <p>PROCESS DESIGNER</p>
            <input value={title} onChange={(event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value)} aria-label="ชื่อกระบวนการ" />
            <div className="processStats"><span>{lanes.length} หน่วยงาน</span><span>{steps.length} ขั้นตอน</span><span>{edges.length} เส้นเชื่อม</span><span>SLA รวม {estimatedHours} ชม.</span></div>
          </div>
          <div className="toolbarButtons">
            <button type="button" className="ghostButton" onClick={resetTemplate}>NT Cloud Template</button>
            <button type="button" className="ghostButton" onClick={() => importRef.current?.click()}>Import</button>
            <input ref={importRef} type="file" accept="application/json" hidden onChange={importFlow} />
            <button type="button" className="ghostButton" onClick={exportFlow}>Export</button>
            <button type="button" className="ghostButton" onClick={save}>Save</button>
            <button type="button" className="runButton" onClick={runSimulation} disabled={running || validationErrors.length > 0}>{running ? 'Running...' : 'Run Flow'}</button>
          </div>
        </header>

        <section className="processCanvasWrap">
          <ReactFlow<BuilderNode, Edge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelectedNodeId(null)}
            fitView
            fitViewOptions={{ padding: 0.08 }}
            minZoom={0.35}
            maxZoom={1.6}
            defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
            deleteKeyCode={null}
            proOptions={{ hideAttribution: true }}
          >
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeStrokeWidth={3} />
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
          </ReactFlow>
          <div className={validationErrors.length === 0 ? 'validationBar valid' : 'validationBar invalid'}>
            <strong>{validationErrors.length === 0 ? 'Flow พร้อมใช้งาน' : `พบ ${validationErrors.length} จุดที่ต้องแก้`}</strong>
            <span>{validationErrors[0] ?? 'โครงสร้างถูกต้อง สามารถบันทึกและจำลองการทำงานได้'}</span>
          </div>
          {notice && <div className="processNotice">{notice}</div>}
        </section>
      </main>

      <aside className="processInspector">
        {selectedStep ? (
          <>
            <div className="inspectorHeader"><div><p>STEP CONFIGURATION</p><h2>{selectedStep.data.title}</h2></div><button type="button" onClick={() => setSelectedNodeId(null)}>×</button></div>
            <label>ประเภทขั้นตอน<select value={selectedStep.data.stepKind} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateSelected({ stepKind: event.target.value as StepKind })}>{palette.map((item) => <option value={item.kind} key={item.kind}>{item.label}</option>)}</select></label>
            <label>ชื่อขั้นตอน<input value={selectedStep.data.title} onChange={(event: ChangeEvent<HTMLInputElement>) => updateSelected({ title: event.target.value })} /></label>
            <label>รายละเอียด<textarea value={selectedStep.data.description} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateSelected({ description: event.target.value })} /></label>
            <label>หน่วยงาน<select value={selectedStep.data.laneId} onChange={(event: ChangeEvent<HTMLSelectElement>) => moveSelectedToLane(event.target.value)}>{lanes.map((lane) => <option value={lane.id} key={lane.id}>{lane.data.name}</option>)}</select></label>
            <label>ผู้รับผิดชอบ<input value={selectedStep.data.owner} onChange={(event: ChangeEvent<HTMLInputElement>) => updateSelected({ owner: event.target.value })} /></label>
            <label>SLA (ชั่วโมง)<input type="number" min="0" value={selectedStep.data.slaHours} onChange={(event: ChangeEvent<HTMLInputElement>) => updateSelected({ slaHours: Number(event.target.value) || 0 })} /></label>
            <label>สถานะ<select value={selectedStep.data.status} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateSelected({ status: event.target.value as StepStatus })}>{(Object.keys(statusLabels) as StepStatus[]).map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}</select></label>
            <button type="button" className="dangerButton" onClick={deleteSelected}>ลบขั้นตอนนี้</button>
          </>
        ) : (
          <>
            <div className="inspectorHeader"><div><p>FLOW OVERVIEW</p><h2>ภาพรวมกระบวนการ</h2></div></div>
            <div className="overviewCards"><article><span>หน่วยงาน</span><strong>{lanes.length}</strong></article><article><span>ขั้นตอน</span><strong>{steps.length}</strong></article><article><span>การเชื่อมโยง</span><strong>{edges.length}</strong></article><article><span>SLA รวม</span><strong>{estimatedHours} ชม.</strong></article></div>
            <section className="validationPanel"><h3>Validation</h3>{validationErrors.length === 0 ? <p className="successText">✓ Flow ถูกต้องและพร้อม Run</p> : <ul>{validationErrors.slice(0, 8).map((error) => <li key={error}>{error}</li>)}</ul>}</section>
            <section className="helpPanel"><h3>วิธีใช้งาน</h3><p>เลือก Lane แล้วเพิ่ม Component จากเมนูด้านซ้าย ลาก Node จัดตำแหน่ง และลากจากจุดเชื่อมด้านล่างไปยังขั้นตอนถัดไป</p></section>
          </>
        )}
      </aside>
    </div>
  );
}

export default function ProcessBuilderPage() {
  return <AuthGate><ReactFlowProvider><ProcessBuilderWorkspace /></ReactFlowProvider></AuthGate>;
}
