'use client';

import type { Node } from '@xyflow/react';

type WorkflowNodeData = {
  label: string;
  config?: string;
};

type WorkflowNode = Node<WorkflowNodeData>;

interface ConfigPanelProps {
  selectedNode: WorkflowNode | null;
  onUpdateNode: (
    nodeId: string,
    data: Partial<WorkflowNodeData>
  ) => void;
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
      <h3 className="mb-4 font-semibold">Node Configuration</h3>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm" htmlFor="node-label">
            Label
          </label>
          <input
            id="node-label"
            type="text"
            value={selectedNode.data.label}
            onChange={(event) =>
              onUpdateNode(selectedNode.id, { label: event.target.value })
            }
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm" htmlFor="node-config">
            Prompt / Config
          </label>
          <textarea
            id="node-config"
            value={selectedNode.data.config ?? ''}
            onChange={(event) =>
              onUpdateNode(selectedNode.id, { config: event.target.value })
            }
            className="h-32 w-full rounded border px-3 py-2"
            placeholder="Enter prompt or configuration..."
          />
        </div>
      </div>
    </div>
  );
}
