'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
} from '@xyflow/react';
import type { Connection, Edge, NodeMouseHandler, Node as FlowNode } from '@xyflow/react';
import type { WorkflowContract, WorkflowInput, WorkflowInputValues, WorkflowRun } from '@cherryflow/ui-schema';
import '@xyflow/react/dist/style.css';
import './canvas.css';

import { AuthGate } from '../../components/AuthGate';
import { requestJson } from '../../lib/client';
import { ConfigPanel, type WorkflowNode, type WorkflowNodeData } from './components/ConfigPanel';
import { Sidebar, type ModuleItem } from './components/Sidebar';

interface CanvasNode {
  id: string;
  moduleType: string;
  label: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

interface CanvasEdge {
  id: string;
  from: string;
  to: string;
}

interface CanvasFlow {
  workflowId: string;
  graph: { outputNodeId: string };
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  updatedAt: string;
}

interface CanvasResponse {
  canvas: CanvasFlow;
  validation: { valid: boolean; errors: string[]; order: string[] };
  modules: ModuleItem[];
}

const workflowId = 'report-generator';

function prettyConfig(value: Record<string, unknown>): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function nodeType(moduleType: string): FlowNode['type'] {
  if (moduleType === 'core.input') return 'input';
  if (moduleType === 'core.output') return 'output';
  return 'default';
}

function toFlowNode(node: CanvasNode): WorkflowNode {
  return {
    id: node.id,
    type: nodeType(node.moduleType),
    position: node.position,
    data: {
      label: node.label,
      moduleType: node.moduleType,
      configText: prettyConfig(node.config),
    },
  };
}

function toFlowEdge(edge: CanvasEdge): Edge {
  return { id: edge.id, source: edge.from, target: edge.to, animated: true, type: 'smoothstep' };
}

function parseConfig(text: string): Record<string, unknown> {
  if (!text.trim()) return {};
  const value = JSON.parse(text) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Config ต้องเป็น JSON object');
  return value as Record<string, unknown>;
}

function sampleValue(field: WorkflowInput) {
  if (field.type === 'file') {
    const text = `CherryFlow canvas sample for ${field.name}`;
    return {
      name: `${field.name}.txt`,
      type: 'text/plain',
      size: text.length,
      dataUrl: `data:text/plain;base64,${btoa(text)}`,
    };
  }
  if (field.type === 'select') return field.options?.[0]?.value ?? '';
  if (field.type === 'number') return 1;
  if (field.type === 'boolean') return true;
  if (field.type === 'date') return new Date().toISOString().slice(0, 10);
  return field.placeholder || field.label || field.name;
}

function sampleInputs(workflow: WorkflowContract | null): WorkflowInputValues {
  return Object.fromEntries((workflow?.inputs ?? []).map((field) => [field.name, sampleValue(field)]));
}

function flowFileName(name: string): string {
  const safeName = name.trim().replace(/[^a-z0-9ก-๙]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return `${safeName || 'cherryflow-flow'}.cherryflow.json`;
}

function CanvasWorkspace() {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowContract | null>(null);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [outputNodeId, setOutputNodeId] = useState('');
  const [validation, setValidation] = useState<CanvasResponse['validation'] | null>(null);
  const [notice, setNotice] = useState('กำลังโหลด Canvas...');
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [busy, setBusy] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const validationText = useMemo(() => {
    if (!validation) return 'Not validated';
    if (validation.valid) return `Graph valid · ${validation.order.length} nodes`;
    return `${validation.errors.length} validation issues`;
  }, [validation]);

  const makeCanvasPayload = useCallback(() => {
    const canvasNodes: CanvasNode[] = nodes.map((node) => ({
      id: node.id,
      moduleType: node.data.moduleType,
      label: node.data.label,
      position: node.position,
      config: parseConfig(node.data.configText),
    }));
    const canvasEdges: CanvasEdge[] = edges.map((edge) => ({
      id: edge.id,
      from: edge.source,
      to: edge.target,
    }));
    return { nodes: canvasNodes, edges: canvasEdges, outputNodeId: outputNodeId || canvasNodes.at(-1)?.id };
  }, [edges, nodes, outputNodeId]);

  const applyCanvasResult = useCallback((result: CanvasResponse) => {
    setModules(result.modules);
    setNodes(result.canvas.nodes.map(toFlowNode));
    setEdges(result.canvas.edges.map(toFlowEdge));
    setOutputNodeId(result.canvas.graph.outputNodeId);
    setValidation(result.validation);
    setSelectedNode(null);
  }, [setEdges, setNodes]);

  const loadCanvas = useCallback(async () => {
    const [canvasResult, workflowResult] = await Promise.all([
      requestJson<CanvasResponse>(`/api/workflows/${workflowId}/canvas`),
      requestJson<WorkflowContract>(`/api/workflows/${workflowId}`),
    ]);
    setWorkflow(workflowResult);
    applyCanvasResult(canvasResult);
    setNotice(`Canvas loaded · ${new Date(canvasResult.canvas.updatedAt).toLocaleString('th-TH')}`);
  }, [applyCanvasResult]);

  useEffect(() => {
    loadCanvas().catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'โหลด Canvas ไม่สำเร็จ'));
  }, [loadCanvas]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((currentEdges) => addEdge({ ...params, animated: true, type: 'smoothstep' }, currentEdges)),
    [setEdges],
  );

  const onNodeClick: NodeMouseHandler<WorkflowNode> = useCallback((_event, node) => {
    setSelectedNode(node);
  }, []);

  const addNode = useCallback(
    (moduleType: string, label: string, position = { x: 260, y: 160 }) => {
      const id = `${moduleType.replace(/[^a-z0-9]+/gi, '-')}-${crypto.randomUUID().slice(0, 8)}`;
      const newNode: WorkflowNode = {
        id,
        type: nodeType(moduleType),
        data: { label, moduleType, configText: prettyConfig({}) },
        position,
      };
      setNodes((currentNodes) => [...currentNodes, newNode]);
      setSelectedNode(newNode);
      setOutputNodeId((current) => current || id);
      setNotice(`Added ${label}`);
    },
    [setNodes],
  );

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData('application/cherryflow-module');
    if (!raw) return;
    const module = JSON.parse(raw) as ModuleItem;
    addNode(module.type, module.label, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  }, [addNode, screenToFlowPosition]);

  const updateNodeData = useCallback(
    (nodeId: string, newData: Partial<WorkflowNodeData>) => {
      const updateNode = (node: WorkflowNode): WorkflowNode => {
        if (node.id !== nodeId) return node;
        const moduleType = newData.moduleType ?? node.data.moduleType;
        return {
          ...node,
          type: nodeType(moduleType),
          data: { ...node.data, ...newData },
        };
      };
      setNodes((currentNodes) => currentNodes.map(updateNode));
      setSelectedNode((currentNode) => currentNode ? updateNode(currentNode) : null);
    },
    [setNodes],
  );

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId));
    setEdges((currentEdges) => currentEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setSelectedNode(null);
    setOutputNodeId((current) => current === nodeId ? '' : current);
    setNotice(`Deleted node ${nodeId}`);
  }, [setEdges, setNodes]);

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const result = await requestJson<CanvasResponse>(`/api/workflows/${workflowId}/canvas`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(makeCanvasPayload()),
      });
      setValidation(result.validation);
      setOutputNodeId(result.canvas.graph.outputNodeId);
      setNotice(result.validation.valid ? 'Saved · Graph valid' : `Saved with ${result.validation.errors.length} validation issues`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Save ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }, [makeCanvasPayload]);

  const exportFlow = useCallback(() => {
    try {
      const flowPackage = {
        format: 'cherryflow.flow',
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        workflow: {
          id: workflowId,
          name: workflow?.name ?? 'CherryFlow Workflow',
        },
        canvas: makeCanvasPayload(),
      };
      const blob = new Blob([JSON.stringify(flowPackage, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = flowFileName(workflow?.name ?? workflowId);
      link.click();
      URL.revokeObjectURL(url);
      setNotice('Exported CherryFlow JSON package');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Export Flow ไม่สำเร็จ');
    }
  }, [makeCanvasPayload, workflow?.name]);

  const importFlow = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const result = await requestJson<CanvasResponse>(`/api/workflows/${workflowId}/canvas/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      applyCanvasResult(result);
      setNotice(`Imported ${file.name} · validated and saved`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Import Flow ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }, [applyCanvasResult]);

  const validate = useCallback(async () => {
    setBusy(true);
    try {
      const result = await requestJson<CanvasResponse>(`/api/workflows/${workflowId}/canvas/validate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(makeCanvasPayload()),
      });
      setValidation(result.validation);
      setNotice(result.validation.valid ? 'Graph validation passed' : `${result.validation.errors.length} validation issues found`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Validate ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }, [makeCanvasPayload]);

  const runCanvas = useCallback(async () => {
    setBusy(true);
    setRun(null);
    try {
      const created = await requestJson<{ run: WorkflowRun }>(`/api/workflows/${workflowId}/canvas/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...makeCanvasPayload(), inputs: sampleInputs(workflow) }),
      });
      setRun(created.run);
      for (let attempt = 0; attempt < 90; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        const current = await requestJson<{ run: WorkflowRun }>(`/api/runs/${created.run.id}`);
        setRun(current.run);
        if (current.run.status === 'completed' || current.run.status === 'failed') break;
      }
      setNotice('Run finished · inspect the result panel');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Run ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }, [makeCanvasPayload, workflow]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!busy) void save();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (!busy && validation?.valid) void runCanvas();
      }
      if (event.key === 'Escape') setSelectedNode(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, runCanvas, save, validation?.valid]);

  return (
    <div className="canvasPage" data-busy={busy ? 'true' : 'false'}>
      <Sidebar modules={modules} onAddNode={addNode} />

      <main className="canvasStage" onDrop={onDrop} onDragOver={(event) => event.preventDefault()} aria-busy={busy}>
        <div className="canvasToolbar">
          <section className="toolbarCard canvasTitleCard">
            <div className="canvasBreadcrumb"><a href="/builder/report-generator">Builder</a><span>/</span><strong>Canvas</strong></div>
            <div className="canvasTitleRow">
              <div>
                <p className="eyebrow">Editable workflow</p>
                <h1>{workflow?.name ?? 'Workflow Canvas'}</h1>
              </div>
              <span className={`statusPill ${validation?.valid ? 'valid' : validation ? 'invalid' : ''}`}><i />{validationText}</span>
            </div>
            <div className="canvasMeta">
              <span><strong>{nodes.length}</strong> nodes</span>
              <span><strong>{edges.length}</strong> connections</span>
              <span><strong>{outputNodeId ? '1' : '0'}</strong> output</span>
            </div>
            {validation && !validation.valid && (
              <details className="canvasValidation">
                <summary>Review validation issues</summary>
                <ol>{validation.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ol>
              </details>
            )}
          </section>

          <div className="toolbarActions" role="toolbar" aria-label="Canvas actions">
            <div className="toolbarGroup">
              <button type="button" className="secondaryButton" onClick={() => importInputRef.current?.click()} disabled={busy}>Import</button>
              <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={importFlow} />
              <button type="button" className="secondaryButton" onClick={exportFlow} disabled={busy}>Export</button>
            </div>
            <div className="toolbarGroup">
              <button type="button" className="secondaryButton" onClick={validate} disabled={busy}>Validate</button>
              <button type="button" className="primaryButton" onClick={save} disabled={busy}>Save <kbd>⌘S</kbd></button>
              <button type="button" className="runButton" onClick={runCanvas} disabled={busy || !validation?.valid}>Run <kbd>⌘↵</kbd></button>
            </div>
          </div>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelectedNode(null)}
          fitView
          fitViewOptions={{ padding: 0.22 }}
          snapToGrid
          snapGrid={[16, 16]}
          minZoom={0.25}
          maxZoom={2}
          selectionOnDrag
          panOnScroll
          proOptions={{ hideAttribution: true }}
        >
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeStrokeWidth={3} />
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        </ReactFlow>

        {notice && <div className="canvasNotice" role="status"><i />{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}
        {run && (
          <section className="toolbarCard runPanel" aria-live="polite">
            <button type="button" className="runPanelClose" aria-label="Close run result" onClick={() => setRun(null)}>×</button>
            <p className="eyebrow">Run result</p>
            <div className="runPanelHeading"><h2>{run.status}</h2><span className={`runStatus run-${run.status}`}>{run.status}</span></div>
            <p className="muted">Run ID: {run.id}</p>
            <pre>{JSON.stringify({ outputs: run.outputs, steps: run.steps, error: run.error }, null, 2)}</pre>
          </section>
        )}
      </main>

      <ConfigPanel
        modules={modules}
        selectedNode={selectedNode}
        outputNodeId={outputNodeId}
        onUpdateNode={updateNodeData}
        onSetOutputNode={setOutputNodeId}
        onDeleteNode={deleteNode}
      />
    </div>
  );
}

export default function CanvasPage() {
  return (
    <AuthGate>
      <ReactFlowProvider>
        <CanvasWorkspace />
      </ReactFlowProvider>
    </AuthGate>
  );
}
