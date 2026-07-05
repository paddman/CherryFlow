'use client';

import { useCallback, useState } from 'react';
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
} from '@xyflow/react';
import type {
  Connection,
  Edge,
  Node,
  NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Sidebar } from './components/Sidebar';
import { ConfigPanel } from './components/ConfigPanel';

type WorkflowNodeData = {
  label: string;
  config?: string;
};

type WorkflowNode = Node<WorkflowNodeData>;

const initialNodes: WorkflowNode[] = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Start' },
    position: { x: 250, y: 50 },
  },
];

const initialEdges: Edge[] = [];

export default function CanvasPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((currentEdges) => addEdge(params, currentEdges)),
    [setEdges]
  );

  const onNodeClick: NodeMouseHandler<WorkflowNode> = useCallback((_event, node) => {
    setSelectedNode(node);
  }, []);

  const addNode = useCallback(
    (type: string, label: string) => {
      const newNode: WorkflowNode = {
        id: crypto.randomUUID(),
        type,
        data: { label },
        position: {
          x: Math.random() * 400 + 100,
          y: Math.random() * 300 + 100,
        },
      };

      setNodes((currentNodes) => [...currentNodes, newNode]);
    },
    [setNodes]
  );

  const updateNodeData = useCallback(
    (nodeId: string, newData: Partial<WorkflowNodeData>) => {
      const updateNode = (node: WorkflowNode): WorkflowNode =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...newData } }
          : node;

      setNodes((currentNodes) => currentNodes.map(updateNode));
      setSelectedNode((currentNode) =>
        currentNode ? updateNode(currentNode) : null
      );
    },
    [setNodes]
  );

  return (
    <div className="flex h-screen">
      <Sidebar onAddNode={addNode} />

      <div className="relative flex-1">
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
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>

        <div className="absolute right-4 top-4 z-10 flex gap-2">
          <button
            type="button"
            onClick={() => console.log('Save workflow', { nodes, edges })}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Save Workflow
          </button>
          <button
            type="button"
            onClick={() => console.log('Run workflow')}
            className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
          >
            Run
          </button>
        </div>
      </div>

      <ConfigPanel
        selectedNode={selectedNode}
        onUpdateNode={updateNodeData}
      />
    </div>
  );
}
