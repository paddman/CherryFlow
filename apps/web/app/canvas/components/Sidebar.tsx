'use client';

interface SidebarProps {
  onAddNode: (type: string, label: string) => void;
}

const nodeTypes = [
  { type: 'input', label: 'Trigger / Start' },
  { type: 'default', label: 'AI Prompt' },
  { type: 'default', label: 'Module' },
  { type: 'output', label: 'Output' },
] as const;

export function Sidebar({ onAddNode }: SidebarProps) {
  return (
    <div className="w-64 border-r bg-gray-50 p-4">
      <h2 className="mb-4 font-semibold">Nodes</h2>
      <div className="space-y-2">
        {nodeTypes.map((node) => (
          <button
            key={node.label}
            type="button"
            onClick={() => onAddNode(node.type, node.label)}
            className="w-full rounded-lg border bg-white p-3 text-left hover:bg-gray-100"
          >
            {node.label}
          </button>
        ))}
      </div>
    </div>
  );
}
