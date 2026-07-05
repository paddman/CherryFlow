'use client';

import { Node } from 'reactflow';

interface ConfigPanelProps {
  selectedNode: Node | null;
  onUpdateNode: (nodeId: string, data: any) => void;
}

export function ConfigPanel({ selectedNode, onUpdateNode }: ConfigPanelProps) {
  if (!selectedNode) {
    return (
      <div className="w-80 border-l bg-white p-4">
        <p className="text-gray-500">Select a node to edit its configuration</p>
      </div>
    );
  }

  return (
    <div className="w-80 border-l bg-white p-4">
      <h3 className="font-semibold mb-4">Node Configuration</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Label</label>
          <input
            type="text"
            value={selectedNode.data.label || ''}
            onChange={(e) => onUpdateNode(selectedNode.id, { label: e.target.value })}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Prompt / Config</label>
          <textarea
            className="w-full border rounded px-3 py-2 h-32"
            placeholder="Enter prompt or configuration..."
          />
        </div>
      </div>
    </div>
  );
}
