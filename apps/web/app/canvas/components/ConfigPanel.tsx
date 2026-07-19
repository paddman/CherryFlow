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

function configState(value: string): { valid: boolean; keys: number } {
  try {
    const parsed = value.trim() ? JSON.parse(value) as unknown : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { valid: false, keys: 0 };
    return { valid: true, keys: Object.keys(parsed).length };
  } catch {
    return { valid: false, keys: 0 };
  }
}

export function ConfigPanel({ modules, selectedNode, outputNodeId, onUpdateNode, onSetOutputNode, onDeleteNode }: ConfigPanelProps) {
  if (!selectedNode) {
    return (
      <aside className="configPanel" aria-label="Node inspector">
        <div className="inspectorEmptyIcon" aria-hidden="true">⌁</div>
        <p className="eyebrow">Inspector</p>
        <h2>Select a node</h2>
        <p className="muted">เลือก node บน canvas เพื่อแก้ label, module type, JSON config และกำหนด output node</p>
        <div className="inspectorTips">
          <span><kbd>Click</kbd> inspect</span>
          <span><kbd>Drag</kbd> reposition</span>
          <span><kbd>Del</kbd> remove</span>
        </div>
      </aside>
    );
  }

  const state = configState(selectedNode.data.configText);
  const isOutput = outputNodeId === selectedNode.id;

  return (
    <aside className="configPanel" aria-label={`Node inspector for ${selectedNode.data.label}`}>
      <div className="inspectorHeading">
        <div>
          <p className="eyebrow">Node inspector</p>
          <h2>{selectedNode.data.label}</h2>
        </div>
        <span className={state.valid ? 'configStatus valid' : 'configStatus invalid'}>{state.valid ? 'JSON valid' : 'Invalid JSON'}</span>
      </div>

      <div className="inspectorMeta">
        <span><strong>{state.keys}</strong> config keys</span>
        <span><strong>{isOutput ? 'Yes' : 'No'}</strong> final output</span>
      </div>

      <div className="configStack">
        <label htmlFor={`node-label-${selectedNode.id}`}>
          <span>Label</span>
          <input
            id={`node-label-${selectedNode.id}`}
            value={selectedNode.data.label}
            onChange={(event) => onUpdateNode(selectedNode.id, { label: event.target.value })}
          />
          <small>ชื่อที่แสดงบน canvas</small>
        </label>

        <label htmlFor={`node-module-${selectedNode.id}`}>
          <span>Module type</span>
          <select
            id={`node-module-${selectedNode.id}`}
            value={selectedNode.data.moduleType}
            onChange={(event) => {
              const module = modules.find((item) => item.type === event.target.value);
              onUpdateNode(selectedNode.id, { moduleType: event.target.value, label: module?.label ?? event.target.value });
            }}
          >
            {modules.map((module) => <option key={module.type} value={module.type}>{module.type}</option>)}
          </select>
          <small>เปลี่ยน executor ที่ node นี้เรียกใช้</small>
        </label>

        <label htmlFor={`node-config-${selectedNode.id}`}>
          <span className="configLabelRow"><span>Config JSON</span><em>{state.valid ? `${state.keys} keys` : 'Fix syntax before save'}</em></span>
          <textarea
            id={`node-config-${selectedNode.id}`}
            value={selectedNode.data.configText}
            onChange={(event) => onUpdateNode(selectedNode.id, { configText: event.target.value })}
            spellCheck={false}
            aria-invalid={!state.valid}
          />
        </label>

        <div className="inspectorActions">
          <button type="button" className={isOutput ? 'secondaryButton selectedAction' : 'secondaryButton'} onClick={() => onSetOutputNode(selectedNode.id)}>
            {isOutput ? '✓ Final output node' : 'Set as final output'}
          </button>
          <button type="button" className="dangerButton" onClick={() => onDeleteNode(selectedNode.id)}>
            Delete node
          </button>
        </div>
      </div>
    </aside>
  );
}
