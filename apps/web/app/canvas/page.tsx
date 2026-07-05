'use client';

import React, { useCallback, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Sidebar } from './components/Sidebar';
import { ConfigPanel } from './components/ConfigPanel';

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Start' },
    position: { x: 250, y: 50 },
  },
];

const initialEdges: Edge[] = [];

export default function CanvasPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const addNode = (type: string, label: string) => {
    const newNode: Node = {
      id: `${Date.now()}`,
      type,
      data: { label },
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const updateNodeData = (nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar onAddNode={addNode} />

      {/* Canvas */}
      <div className="flex-1 relative">
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

        {/* Top Bar */}
        <div className="absolute top-4 right-4 flex gap-2">
          <button 
            onClick={() => console.log('Save workflow', { nodes, edges })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save Workflow
          </button>
          <button 
            onClick={() => console.log('Run workflow')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Run
          </button>
        </div>
      </div>

      {/* Config Panel */}
      <ConfigPanel 
        selectedNode={selectedNode} 
        onUpdateNode={updateNodeData} 
      />
    </div>
  );
}
