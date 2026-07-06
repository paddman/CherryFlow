"use client";

import { useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
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

function WorkflowNodeCard({ data, selected }: NodeProps<WorkflowFlowNode>) {
  return (
    <div className={`builderFlowNode builderFlowNode-${data.role}${selected ? " selected" : ""}`}>
      {data.role !== "input" && <Handle type="target" position={Position.Left} isConnectable={false} />}
      <span className="builderFlowNodeRole">{data.role}</span>
      <strong>{data.label}</strong>
      <small>{data.moduleType}</small>
      {data.role === "output" && <em>Final output</em>}
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
      position: { x: 80 + rank * 300, y: 90 + row * 180 },
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
    markerEnd: { type: MarkerType.ArrowClosed },
  }));
}

export function WorkflowGraphPanel({ graph, validation }: WorkflowGraphPanelProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const nodes = useMemo(() => graph ? createNodes(graph, validation?.order ?? []) : [], [graph, validation?.order]);
  const edges = useMemo(() => graph ? createEdges(graph) : [], [graph]);
  const selectedNode = graph?.nodes.find((node) => node.id === selectedNodeId) ?? null;

  const onNodeClick: NodeMouseHandler<WorkflowFlowNode> = (_event, node) => {
    setSelectedNodeId(node.id);
  };

  if (!graph) {
    return (
      <section className="builderFlowPanel builderFlowEmpty">
        <h2>กำลังโหลด Workflow Graph...</h2>
      </section>
    );
  }

  return (
    <section className="builderFlowPanel">
      <header className="builderFlowHeader">
        <div>
          <p className="sectionLabel">WORKFLOW GRAPH</p>
          <h2>Visual Flow</h2>
          <span className={validation?.valid ? "builderGraphValid" : "builderGraphInvalid"}>
            {validation?.valid ? `Graph valid · ${nodes.length} nodes · ${edges.length} connections` : validation?.errors.join(" · ") || "Graph needs attention"}
          </span>
        </div>
        <a className="secondaryButton" href="/canvas">Open editable Canvas</a>
      </header>

      <div className="builderFlowCanvas">
        <ReactFlow<WorkflowFlowNode, Edge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          nodesDraggable
          nodesConnectable={false}
          edgesReconnectable={false}
          fitView
          fitViewOptions={{ padding: 0.24 }}
          minZoom={0.35}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
        >
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeStrokeWidth={3} />
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
        </ReactFlow>

        {selectedNode && (
          <aside className="builderFlowInspector">
            <button type="button" aria-label="Close node inspector" onClick={() => setSelectedNodeId(null)}>×</button>
            <p className="sectionLabel">SELECTED NODE</p>
            <h3>{selectedNode.id}</h3>
            <code>{selectedNode.moduleType}</code>
            <span>Configuration</span>
            <pre>{JSON.stringify(selectedNode.config ?? {}, null, 2)}</pre>
          </aside>
        )}
      </div>
    </section>
  );
}
