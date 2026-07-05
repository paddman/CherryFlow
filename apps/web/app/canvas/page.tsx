'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  return { id: edge.id, source: edge.from, target: edge.to, animated: true };
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
  const { screenToFlowPosition } = useReactFlow();

  const validationText = useMemo(() => {
    if (!validation) return 'ยังไม่ validate';
    if (validation.valid) return `Graph valid · ${validation.order.length} nodes`;
    return validation.errors.join(' · ');
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

  const loadCanvas = useCallback(async () => {
    const [canvasResult, workflowResult] = await Promise.all([
      requestJson<CanvasResponse>(`/api/workflows/${workflowId}/canvas`),
      requestJson<WorkflowContract>(`/api/workflows/${workflowId}`),
    ]);
    setWorkflow(workflowResult);
    setModules(canvasResult.modules);
    setNodes(canvasResult.canvas.nodes.map(toFlowNode));
    setEdges(canvasResult.canvas.edges.map(toFlowEdge));
    setOutputNodeId(canvasResult.canvas.graph.outputNodeId);
    setValidation(canvasResult.validation);
    setNotice(`โหลด Canvas แล้ว · อัปเดตล่าสุด ${new Date(canvasResult.canvas.updatedAt).toLocaleString('th-TH')}`);
  }, [setEdges, setNodes]);

  useEffect(() => {
    loadCanvas().catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'โหลด Canvas ไม่สำเร็จ'));
  }, [loadCanvas]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((currentEdges) => addEdge({ ...params, animated: true }, currentEdges)),
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
      setNotice(result.validation.valid ? 'Save สำเร็จ · Graph valid' : `Save สำเร็จ แต่ graph ยังมีปัญหา: ${result.validation.errors.join(', ')}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Save ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }, [makeCanvasPayload]);

  const validate = useCallback(async () => {
    try {
      const result = await requestJson<CanvasResponse>(`/api/workflows/${workflowId}/canvas/validate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(makeCanvasPayload()),
      });
      setValidation(result.validation);
      setNotice(result.validation.valid ? 'Graph valid' : result.validation.errors.join(' · '));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Validate ไม่สำเร็จ');
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
      setNotice('Run เสร็จแล้ว ดูผลที่มุมขวาล่าง');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Run ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }, [makeCanvasPayload, workflow]);

  return (
    <div className="canvasPage">
      <Sidebar modules={modules} onAddNode={addNode} />

      <main className="canvasStage" onDrop={onDrop} onDragOver={(event) => event.preventDefault()}>
        <div className="canvasToolbar">
          <section className="toolbarCard">
            <p className="eyebrow">CherryFlow Canvas</p>
            <h1>{workflow?.name ?? 'Workflow Canvas'}</h1>
            <span className={`statusPill ${validation?.valid ? 'valid' : validation ? 'invalid' : ''}`}>{validationText}</span>
          </section>
          <div className="toolbarActions">
            <button type="button" className="secondaryButton" onClick={validate} disabled={busy}>Validate</button>
            <button type="button" className="primaryButton" onClick={save} disabled={busy}>Save</button>
            <button type="button" className="primaryButton" onClick={runCanvas} disabled={busy || !validation?.valid}>Run</button>
          </div>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          fitView
        >
          <Controls />
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={14} size={1} />
        </ReactFlow>

        {notice && <div className="canvasNotice">{notice}</div>}
        {run && (
          <section className="toolbarCard runPanel">
            <p className="eyebrow">Run Result</p>
            <h2>{run.status}</h2>
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
    <ReactFlowProvider>
      <CanvasWorkspace />
    </ReactFlowProvider>
  );
}
