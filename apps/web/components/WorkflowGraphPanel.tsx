"use client";

import { useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
} from "@xyflow/react";
import type { Edge, Node, NodeMouseHandler, NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./WorkflowGraphPanel.css";

export interface WorkflowGraph {
  version: string;
  nodes: Array<{ id: string; moduleType: string; config?: Record<string, unknown> }>;
  edges: Array<{ from: string; to: string }>;
  outputNodeId: string;
}

interface GraphValidation {
  valid: boolean;
  errors: string[];
  order: string[];
}

interface WorkflowGraphPanelProps {
  graph: WorkflowGraph | null;
  validation: GraphValidation | null;
}

type WorkflowNodeRole = "input" | "module" | "output";

type WorkflowNodeData = Record<string, unknown> & {
  label: string;
  moduleType: string;
  role: WorkflowNodeRole;
  config: Record<string, unknown>;
};

type WorkflowFlowNode = Node<WorkflowNodeData, "workflowNode">;

const nodeTypes = { workflowNode: WorkflowNodeCard };

function roleLabel(role: WorkflowNodeRole) {
  if (role === "input") return "IN";
  if (role === "output") return "OUT";
  return "FX";
}

function WorkflowNodeCard({ data, selected }: NodeProps<WorkflowFlowNode>) {
  const configEntries = Object.keys(data.config).length;
  return (
    <div className={`builderFlowNode builderFlowNode-${data.role}${selected ? " selected" : ""}`}>
      {data.role !== "input" && <Handle type="target" position={Position.Left} isConnectable={false} />}
      <div className="builderFlowNodeTop">
        <span className="builderFlowNodeIcon" aria-hidden="true">{roleLabel(data.role)}</span>
        <span className="builderFlowNodeRole">{data.role}</span>
      </div>
      <strong>{data.label}</strong>
      <small>{data.moduleType}</small>
      <div className="builderFlowNodeMeta">
        <span>{configEntries} config keys</span>
        {data.role === "output" && <em>Final output</em>}
      </div>
      {data.role !== "output" && <Handle type="source" position={Position.Right} isConnectable={false} />}
    </div>
  );
}

function createNodes(graph: WorkflowGraph, order: string[]): WorkflowFlowNode[] {
  const rankById = new Map(graph.nodes.map((node) => [node.id, 0]));
  const traversal = order.length > 0 ? order : graph.nodes.map((node) => node.id);

  for (const nodeId of traversal) {
    const sourceRank = rankById.get(nodeId) ?? 0;
    for (const edge of graph.edges.filter((item) => item.from === nodeId)) {
      rankById.set(edge.to, Math.max(rankById.get(edge.to) ?? 0, sourceRank + 1));
    }
  }

  const groups = new Map<number, string[]>();
  for (const node of graph.nodes) {
    const rank = rankById.get(node.id) ?? 0;
    groups.set(rank, [...(groups.get(rank) ?? []), node.id]);
  }

  return graph.nodes.map((node) => {
    const rank = rankById.get(node.id) ?? 0;
    const group = groups.get(rank) ?? [node.id];
    const row = Math.max(0, group.indexOf(node.id));
    const role: WorkflowNodeRole = node.moduleType === "core.input"
      ? "input"
      : node.id === graph.outputNodeId || node.moduleType === "core.output"
        ? "output"
        : "module";

    return {
      id: node.id,
      type: "workflowNode",
      position: { x: 80 + rank * 320, y: 92 + row * 190 },
      data: {
        label: node.id,
        moduleType: node.moduleType,
        role,
        config: node.config ?? {},
      },
    };
  });
}

function createEdges(graph: WorkflowGraph): Edge[] {
  return graph.edges.map((edge, index) => ({
    id: `${edge.from}-${edge.to}-${index}`,
    source: edge.from,
    target: edge.to,
    animated: true,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed },
  }));
}

export function WorkflowGraphPanel({ graph, validation }: WorkflowGraphPanelProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const nodes = useMemo(() => graph ? createNodes(graph, validation?.order ?? []) : [], [graph, validation?.order]);
  const edges = useMemo(() => graph ? createEdges(graph) : [], [graph]);
  const selectedNode = graph?.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const configuredNodeCount = graph?.nodes.filter((node) => Object.keys(node.config ?? {}).length > 0).length ?? 0;

  const onNodeClick: NodeMouseHandler<WorkflowFlowNode> = (_event, node) => {
    setSelectedNodeId(node.id);
  };

  if (!graph) {
    return (
      <section className="builderFlowPanel builderFlowEmpty" aria-live="polite">
        <div className="builderFlowEmptyIcon">⌁</div>
        <h2>กำลังโหลด Workflow Graph...</h2>
        <p>CherryFlow กำลังอ่าน nodes, connections และ validation order</p>
      </section>
    );
  }

  return (
    <section className="builderFlowPanel">
      <header className="builderFlowHeader">
        <div className="builderFlowTitle">
          <p className="sectionLabel">EXECUTION GRAPH</p>
          <div>
            <h2>Visual workflow</h2>
            <span className={validation?.valid ? "builderGraphValid" : "builderGraphInvalid"}>
              <i />
              {validation?.valid ? "Graph healthy" : "Needs attention"}
            </span>
          </div>
          <p>Inspect execution order and node configuration before opening the editable canvas.</p>
        </div>
        <div className="builderFlowHeaderActions">
          <div className="builderFlowStats" aria-label="Graph summary">
            <span><strong>{nodes.length}</strong> nodes</span>
            <span><strong>{edges.length}</strong> links</span>
            <span><strong>{configuredNodeCount}</strong> configured</span>
          </div>
          {validation?.errors.length ? (
            <button type="button" className="secondaryButton" onClick={() => setShowIssues((current) => !current)}>
              {validation.errors.length} issues
            </button>
          ) : null}
          <a className="primaryButton" href="/canvas">Open editable canvas</a>
        </div>
      </header>

      {showIssues && validation?.errors.length ? (
        <aside className="builderFlowIssues" role="alert">
          <div>
            <strong>Graph validation issues</strong>
            <span>Fix these items before running or publishing the workflow.</span>
          </div>
          <ol>{validation.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ol>
          <button type="button" aria-label="Close validation issues" onClick={() => setShowIssues(false)}>×</button>
        </aside>
      ) : null}

      <div className="builderFlowCanvas" aria-label="Workflow graph canvas">
        <ReactFlow<WorkflowFlowNode, Edge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelectedNodeId(null)}
          nodesDraggable
          nodesConnectable={false}
          edgesReconnectable={false}
          selectionOnDrag
          panOnScroll
          fitView
          fitViewOptions={{ padding: 0.24 }}
          minZoom={0.28}
          maxZoom={1.8}
          proOptions={{ hideAttribution: true }}
        >
          <Panel position="top-left" className="builderFlowCanvasHint">
            <span>Drag to explore</span>
            <kbd>Scroll</kbd>
            <span>to pan</span>
          </Panel>
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeStrokeWidth={3} />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        </ReactFlow>

        {selectedNode && (
          <aside className="builderFlowInspector" aria-label={`Node inspector for ${selectedNode.id}`}>
            <button type="button" aria-label="Close node inspector" onClick={() => setSelectedNodeId(null)}>×</button>
            <div className="builderFlowInspectorHeader">
              <span className="builderFlowNodeIcon" aria-hidden="true">
                {selectedNode.moduleType === "core.input" ? "IN" : selectedNode.id === graph.outputNodeId ? "OUT" : "FX"}
              </span>
              <div>
                <p className="sectionLabel">NODE INSPECTOR</p>
                <h3>{selectedNode.id}</h3>
              </div>
            </div>
            <code>{selectedNode.moduleType}</code>
            <dl>
              <div><dt>Role</dt><dd>{selectedNode.moduleType === "core.input" ? "Input" : selectedNode.id === graph.outputNodeId ? "Output" : "Module"}</dd></div>
              <div><dt>Config keys</dt><dd>{Object.keys(selectedNode.config ?? {}).length}</dd></div>
              <div><dt>Graph version</dt><dd>{graph.version}</dd></div>
            </dl>
            <div className="builderFlowConfigHeader">
              <span>Configuration</span>
              <small>Read-only preview</small>
            </div>
            <pre>{JSON.stringify(selectedNode.config ?? {}, null, 2)}</pre>
          </aside>
        )}
      </div>
    </section>
  );
}
