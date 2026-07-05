'use client';

import type { Node } from '@xyflow/react';
import type { ModuleItem } from './Sidebar';

export type WorkflowNodeData = Record<string, unknown> & {
  label: string;
  moduleType: string;
  configText: string;
};

export type WorkflowNode = Node<WorkflowNodeData>;

interface ConfigPanelProps {
  modules: ModuleItem[];
  selectedNode: WorkflowNode | null;
  outputNodeId: string;
  onUpdateNode: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  onSetOutputNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
}

export function ConfigPanel({ modules, selectedNode, outputNodeId, onUpdateNode, onSetOutputNode, onDeleteNode }: ConfigPanelProps) {
  if (!selectedNode) {
    return (
      <aside className="configPanel">
        <p className="eyebrow">Inspector</p>
        <h2>เลือก node เพื่อแก้ config</h2>
        <p className="muted">รองรับ JSON config ต่อ node และเลือก output node สำหรับ graph validation</p>
      </aside>
    );
  }

  return (
    <aside className="configPanel">
      <p className="eyebrow">Inspector</p>
      <h2>{selectedNode.data.label}</h2>
      <div className="configStack">
        <label>
          Label
          <input
            value={selectedNode.data.label}
            onChange={(event) => onUpdateNode(selectedNode.id, { label: event.target.value })}
          />
        </label>

        <label>
          Module type
          <select
            value={selectedNode.data.moduleType}
            onChange={(event) => {
              const module = modules.find((item) => item.type === event.target.value);
              onUpdateNode(selectedNode.id, { moduleType: event.target.value, label: module?.label ?? event.target.value });
            }}
          >
            {modules.map((module) => <option key={module.type} value={module.type}>{module.type}</option>)}
          </select>
        </label>

        <label>
          Config JSON
          <textarea
            value={selectedNode.data.configText}
            onChange={(event) => onUpdateNode(selectedNode.id, { configText: event.target.value })}
            spellCheck={false}
          />
        </label>

        <button type="button" className="secondaryButton" onClick={() => onSetOutputNode(selectedNode.id)}>
          {outputNodeId === selectedNode.id ? 'เป็น Output Node แล้ว' : 'Set as Output Node'}
        </button>
        <button type="button" className="dangerButton" onClick={() => onDeleteNode(selectedNode.id)}>
          Delete Node
        </button>
      </div>
    </aside>
  );
}
