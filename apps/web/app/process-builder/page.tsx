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
  STORAGE_KEY,
  applySwimlaneLayout,
  createTemplate,
  isLaneNode,
  isStepNode,
  lanePosition,
  normalizeSavedProcess,
  normalizeSwimlaneConfig,
  makeLane,
  makeStep,
  palette,
  statusLabels,
  stepLabels,
  stepPosition,
  swimlaneConfigForPreset,
  swimlanePresets,
  sortLanes,
  topologicalOrder,
  validateProcess,
  type BuilderNode,
  type LaneFlowNode,
  type SavedProcess,
  type StepFlowNode,
  type StepKind,
  type StepNodeData,
  type StepStatus,
  type SwimlaneConfig,
  type SwimlaneLayoutPreset,
} from './process-model';

type SwimlaneConfigPatch = Partial<Omit<SwimlaneConfig, 'theme'>> & { theme?: Partial<SwimlaneConfig['theme']> };

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
        <span className="stepTypeGroup">
          {data.referenceCode && <span className="stepReference">{data.referenceCode}</span>}
          <span className="stepType">{stepLabels[data.stepKind]}</span>
        </span>
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
const presetLabels: Record<SwimlaneLayoutPreset, string> = {
  horizontal: 'Horizontal',
  vertical: 'Vertical',
  compact: 'Compact',
  document: 'Document',
  kanban: 'Kanban',
  timeline: 'Timeline',
};

const shadowLabels: Record<SwimlaneConfig['theme']['shadowDensity'], string> = {
  none: 'Flat',
  soft: 'Soft',
  strong: 'Strong',
};

function shadowValue(density: SwimlaneConfig['theme']['shadowDensity']): string {
  if (density === 'strong') return '0 10px 30px rgba(15,23,42,.14)';
  if (density === 'soft') return '0 5px 18px rgba(15,23,42,.08)';
  return 'none';
}

function ProcessBuilderWorkspace() {
  const template = useMemo(createTemplate, []);
  const [title, setTitle] = useState(template.title);
  const [swimlaneConfig, setSwimlaneConfig] = useState<SwimlaneConfig>(template.swimlaneConfig);
  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderNode>(template.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(template.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeLaneId, setActiveLaneId] = useState('lane-requester');
  const [notice, setNotice] = useState('โหลด NT Cloud Service Flow จากไฟล์ HTML ต้นฉบับแล้ว');
  const [running, setRunning] = useState(false);
  const [configJson, setConfigJson] = useState(() => JSON.stringify(template.swimlaneConfig, null, 2));
  const importRef = useRef<HTMLInputElement | null>(null);

  const lanes = useMemo(() => sortLanes(nodes.filter(isLaneNode), swimlaneConfig), [nodes, swimlaneConfig]);
  const steps = useMemo(() => nodes.filter(isStepNode), [nodes]);
  const selectedStep = useMemo(() => steps.find((node) => node.id === selectedNodeId) ?? null, [selectedNodeId, steps]);
  const validationErrors = useMemo(() => validateProcess(steps, edges), [edges, steps]);
  const estimatedHours = useMemo(() => steps.reduce((sum, node) => sum + node.data.slaHours, 0), [steps]);
  const renderedEdges = useMemo(() => edges.map((edge) => ({
    ...edge,
    label: swimlaneConfig.showEdgeLabels ? edge.label : undefined,
    style: { ...edge.style, stroke: swimlaneConfig.theme.lineColor },
  })), [edges, swimlaneConfig.showEdgeLabels, swimlaneConfig.theme.lineColor]);
  const pageStyle = useMemo(() => ({
    '--pf-canvas-bg': swimlaneConfig.theme.backgroundColor,
    '--pf-border': swimlaneConfig.theme.lineColor,
    '--pf-lane-radius': `${swimlaneConfig.theme.radius}px`,
    '--pf-step-shadow': shadowValue(swimlaneConfig.theme.shadowDensity),
  }) as CSSProperties, [swimlaneConfig]);

  useEffect(() => {
    setConfigJson(JSON.stringify(swimlaneConfig, null, 2));
  }, [swimlaneConfig]);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = normalizeSavedProcess(JSON.parse(saved));
      setTitle(parsed.title || template.title);
      setSwimlaneConfig(parsed.swimlaneConfig);
      setNodes(parsed.nodes);
      setEdges(parsed.edges);
      setNotice('กู้คืน Flow ล่าสุดจากเครื่องนี้แล้ว');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'พบข้อมูล Flow เดิม แต่ไม่สามารถอ่านได้');
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

  const applyConfig = useCallback((nextConfig: SwimlaneConfig, message = 'อัปเดต Swimlane config แล้ว') => {
    setSwimlaneConfig(nextConfig);
    setNodes((current) => applySwimlaneLayout(current, nextConfig));
    setNotice(message);
  }, [setNodes]);

  const updateConfig = useCallback((patch: SwimlaneConfigPatch) => {
    const nextConfig = normalizeSwimlaneConfig({ ...swimlaneConfig, ...patch, theme: { ...swimlaneConfig.theme, ...(patch.theme ?? {}) } });
    applyConfig(nextConfig);
  }, [applyConfig, swimlaneConfig]);

  const applyPreset = useCallback((preset: SwimlaneLayoutPreset) => {
    applyConfig(swimlaneConfigForPreset(preset), `เปลี่ยน Swimlane เป็น ${presetLabels[preset]} แล้ว`);
  }, [applyConfig]);

  const resetCurrentPreset = useCallback(() => {
    applyConfig(swimlaneConfigForPreset(swimlaneConfig.layoutPreset), `คืนค่า ${presetLabels[swimlaneConfig.layoutPreset]} preset แล้ว`);
  }, [applyConfig, swimlaneConfig.layoutPreset]);

  const applyConfigJson = useCallback(() => {
    try {
      applyConfig(normalizeSwimlaneConfig(JSON.parse(configJson)), 'Apply Advanced JSON config แล้ว');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Advanced JSON config ไม่ถูกต้อง');
    }
  }, [applyConfig, configJson]);

  const addStep = useCallback((stepKind: StepKind) => {
    const lane = lanes.find((item) => item.id === activeLaneId) ?? lanes[0];
    if (!lane) return;
    const laneIndex = Math.max(0, lanes.findIndex((item) => item.id === lane.id));
    const laneSteps = steps.filter((node) => node.data.laneId === lane.id);
    const id = `${stepKind}-${crypto.randomUUID().slice(0, 8)}`;
    const newNode = makeStep(
      id,
      lane.id,
      laneIndex,
      laneSteps.length,
      stepKind,
      `ขั้นตอนใหม่: ${stepLabels[stepKind]}`,
      '',
      lane.data.name,
      stepKind === 'task' || stepKind === 'approval' ? 4 : 0,
      '',
      swimlaneConfig,
    );
    setNodes((current) => [...current, newNode]);
    setSelectedNodeId(id);
    setNotice(`เพิ่ม ${stepLabels[stepKind]} ใน Lane ${lane.data.name} แล้ว`);
  }, [activeLaneId, lanes, setNodes, steps, swimlaneConfig]);

  const addLane = useCallback(() => {
    const id = `lane-${crypto.randomUUID().slice(0, 8)}`;
    const colors = ['#ea580c', '#16a34a', '#db2777', '#4f46e5'];
    const lane = makeLane(id, `หน่วยงาน ${lanes.length + 1}`, lanes.length, colors[lanes.length % colors.length] ?? '#2563eb', swimlaneConfig);
    setNodes((current) => [...current, lane]);
    setActiveLaneId(id);
    setNotice('เพิ่ม Swimlane ใหม่แล้ว');
  }, [lanes.length, setNodes, swimlaneConfig]);

  const renameLane = useCallback((laneId: string, name: string) => {
    setNodes((current) => current.map((node) => isLaneNode(node) && node.id === laneId
      ? { ...node, data: { ...node.data, name } }
      : node));
  }, [setNodes]);

  const updateLaneColor = useCallback((laneId: string, color: string) => {
    setNodes((current) => current.map((node) => isLaneNode(node) && node.id === laneId
      ? { ...node, data: { ...node.data, color } }
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
    const nextPosition = new Map(remaining.map((lane, index) => [lane.id, lanePosition(index, swimlaneConfig)]));
    setNodes((current) => current
      .filter((node) => node.id !== laneId)
      .map((node) => {
        if (isLaneNode(node)) return { ...node, position: nextPosition.get(node.id) ?? node.position };
        const laneIndex = remaining.findIndex((lane) => lane.id === node.data.laneId);
        const indexInLane = steps.filter((step) => step.data.laneId === node.data.laneId).findIndex((step) => step.id === node.id);
        return laneIndex < 0 ? node : { ...node, position: stepPosition(laneIndex, Math.max(0, indexInLane), swimlaneConfig) };
      }));
    const nextLane = remaining[0];
    if (nextLane) setActiveLaneId(nextLane.id);
    setNotice('ลบ Lane แล้ว');
  }, [lanes, setNodes, steps, swimlaneConfig]);

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
    const laneIndex = Math.max(0, lanes.findIndex((item) => item.id === laneId));
    const laneSteps = steps.filter((node) => node.data.laneId === laneId && node.id !== selectedNodeId);
    setNodes((current) => current.map((node) => isStepNode(node) && node.id === selectedNodeId
      ? { ...node, position: stepPosition(laneIndex, laneSteps.length, swimlaneConfig), data: { ...node.data, laneId } }
      : node));
    setActiveLaneId(laneId);
  }, [lanes, selectedNodeId, setNodes, steps, swimlaneConfig]);

  const deleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((current) => current.filter((node) => node.id !== selectedNodeId));
    setEdges((current) => current.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
    setSelectedNodeId(null);
    setNotice('ลบขั้นตอนและเส้นเชื่อมที่เกี่ยวข้องแล้ว');
  }, [selectedNodeId, setEdges, setNodes]);

  const save = useCallback(() => {
    const payload: SavedProcess = { version: 2, title, swimlaneConfig, nodes, edges };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setNotice(`บันทึก Flow แล้ว · ${new Date().toLocaleTimeString('th-TH')}`);
  }, [edges, nodes, swimlaneConfig, title]);

  const resetTemplate = useCallback(() => {
    const fresh = createTemplate();
    setTitle(fresh.title);
    setSwimlaneConfig(fresh.swimlaneConfig);
    setNodes(fresh.nodes);
    setEdges(fresh.edges);
    setSelectedNodeId(null);
    setActiveLaneId('lane-requester');
    setNotice('โหลด NT Cloud Service Flow จากไฟล์ HTML ต้นฉบับแล้ว');
  }, [setEdges, setNodes]);

  const exportFlow = useCallback(() => {
    const payload: SavedProcess = { version: 2, title, swimlaneConfig, nodes, edges };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9ก-๙]+/gi, '-').replace(/^-|-$/g, '') || 'cherryflow-process'}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Export Flow เป็น JSON แล้ว');
  }, [edges, nodes, swimlaneConfig, title]);

  const importFlow = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = normalizeSavedProcess(JSON.parse(await file.text()));
      setTitle(parsed.title || 'Imported Process');
      setSwimlaneConfig(parsed.swimlaneConfig);
      setNodes(parsed.nodes);
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
    <div className={`processBuilderPage preset-${swimlaneConfig.layoutPreset}`} style={pageStyle}>
      <aside className="processSidebar">
        <div className="processBrand"><span className="processBrandMark">C</span><div><strong>CherryFlow</strong><small>Business Process Builder</small></div></div>
        <section className="sidebarSection">
          <div className="sidebarHeading"><span>SWIMLANES</span><button type="button" onClick={addLane}>＋</button></div>
          <div className="laneList">
            {lanes.map((lane) => (
              <article className={activeLaneId === lane.id ? 'laneListItem active' : 'laneListItem'} key={lane.id}>
                <button type="button" className="laneSelect" onClick={() => setActiveLaneId(lane.id)}><span style={{ background: lane.data.color }} /></button>
                <input value={lane.data.name} onChange={(event: ChangeEvent<HTMLInputElement>) => renameLane(lane.id, event.target.value)} aria-label={`ชื่อ Lane ${lane.data.name}`} />
                <input className="laneColorInput" type="color" value={lane.data.color} onChange={(event: ChangeEvent<HTMLInputElement>) => updateLaneColor(lane.id, event.target.value)} aria-label={`สี Lane ${lane.data.name}`} />
                <button type="button" className="laneDelete" onClick={() => deleteLane(lane.id)} aria-label={`ลบ Lane ${lane.data.name}`}>×</button>
              </article>
            ))}
          </div>
        </section>
        <section className="sidebarSection">
          <div className="sidebarHeading"><span>SWIMLANE CONFIG</span><button type="button" onClick={resetCurrentPreset}>↺</button></div>
          <div className="configPanel">
            <label>Preset<select value={swimlaneConfig.layoutPreset} onChange={(event: ChangeEvent<HTMLSelectElement>) => applyPreset(event.target.value as SwimlaneLayoutPreset)}>{swimlanePresets.map((preset) => <option value={preset} key={preset}>{presetLabels[preset]}</option>)}</select></label>
            <div className="configGrid">
              <label>Lane W<input type="number" min="240" max="1600" value={swimlaneConfig.laneWidth} onChange={(event: ChangeEvent<HTMLInputElement>) => updateConfig({ laneWidth: Number(event.target.value) })} /></label>
              <label>Lane H<input type="number" min="220" max="1800" value={swimlaneConfig.laneHeight} onChange={(event: ChangeEvent<HTMLInputElement>) => updateConfig({ laneHeight: Number(event.target.value) })} /></label>
              <label>Gap<input type="number" min="8" max="160" value={swimlaneConfig.laneGap} onChange={(event: ChangeEvent<HTMLInputElement>) => updateConfig({ laneGap: Number(event.target.value) })} /></label>
              <label>Step<input type="number" min="72" max="420" value={swimlaneConfig.stepSpacing} onChange={(event: ChangeEvent<HTMLInputElement>) => updateConfig({ stepSpacing: Number(event.target.value) })} /></label>
            </div>
            <div className="configChecks">
              <label><input type="checkbox" checked={swimlaneConfig.showGrid} onChange={(event: ChangeEvent<HTMLInputElement>) => updateConfig({ showGrid: event.target.checked })} /> Grid</label>
              <label><input type="checkbox" checked={swimlaneConfig.showMinimap} onChange={(event: ChangeEvent<HTMLInputElement>) => updateConfig({ showMinimap: event.target.checked })} /> Minimap</label>
              <label><input type="checkbox" checked={swimlaneConfig.showEdgeLabels} onChange={(event: ChangeEvent<HTMLInputElement>) => updateConfig({ showEdgeLabels: event.target.checked })} /> Edge labels</label>
            </div>
            <div className="configGrid">
              <label>Canvas<input type="color" value={swimlaneConfig.theme.backgroundColor} onChange={(event: ChangeEvent<HTMLInputElement>) => updateConfig({ theme: { backgroundColor: event.target.value } })} /></label>
              <label>Line<input type="color" value={swimlaneConfig.theme.lineColor} onChange={(event: ChangeEvent<HTMLInputElement>) => updateConfig({ theme: { lineColor: event.target.value } })} /></label>
              <label>Radius<input type="number" min="0" max="999" value={swimlaneConfig.theme.radius} onChange={(event: ChangeEvent<HTMLInputElement>) => updateConfig({ theme: { radius: Number(event.target.value) } })} /></label>
              <label>Shadow<select value={swimlaneConfig.theme.shadowDensity} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateConfig({ theme: { shadowDensity: event.target.value as SwimlaneConfig['theme']['shadowDensity'] } })}>{(Object.keys(shadowLabels) as Array<SwimlaneConfig['theme']['shadowDensity']>).map((density) => <option value={density} key={density}>{shadowLabels[density]}</option>)}</select></label>
            </div>
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
            <button type="button" className="ghostButton" onClick={resetTemplate}>โหลด NT Cloud Flow</button>
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
            edges={renderedEdges}
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
            defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: swimlaneConfig.theme.lineColor } }}
            deleteKeyCode={null}
            proOptions={{ hideAttribution: true }}
          >
            <Controls showInteractive={false} />
            {swimlaneConfig.showMinimap && <MiniMap pannable zoomable nodeStrokeWidth={3} />}
            {swimlaneConfig.showGrid && <Background variant={BackgroundVariant.Dots} gap={18} size={1} />}
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
            <section className="advancedConfigPanel">
              <h3>Advanced JSON Config</h3>
              <textarea value={configJson} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setConfigJson(event.target.value)} spellCheck={false} />
              <button type="button" className="ghostButton" onClick={applyConfigJson}>Apply JSON Config</button>
            </section>
            <section className="helpPanel"><h3>วิธีใช้งาน</h3><p>Flow นี้แปลงจาก nt-cloud-service-flow.html เป็น task workflow แล้ว เลือก Lane เพิ่ม Component ลาก Node จัดตำแหน่ง และลากจากจุดเชื่อมด้านล่างไปยังขั้นตอนถัดไป</p></section>
          </>
        )}
      </aside>
    </div>
  );
}

export default function ProcessBuilderPage() {
  return <AuthGate><ReactFlowProvider><ProcessBuilderWorkspace /></ReactFlowProvider></AuthGate>;
}
