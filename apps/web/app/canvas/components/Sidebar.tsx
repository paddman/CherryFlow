'use client';

interface SidebarProps {
  onAddNode: (type: string, label: string) => void;
}

export function Sidebar({ onAddNode }: SidebarProps) {
  const nodeTypes = [
    { type: 'input', label: 'Trigger / Start' },
    { type: 'default', label: 'AI Prompt' },
    { type: 'default', label: 'Module' },
    { type: 'output', label: 'Output' },
  ];

  return (
    <div className="w-64 border-r bg-gray-50 p-4">
      <h2 className="font-semibold mb-4">Nodes</h2>
      <div className="space-y-2">
        {nodeTypes.map((node, index) => (
          <button
            key={index}
            onClick={() => onAddNode(node.type, node.label)}
            className="w-full p-3 bg-white border rounded-lg hover:bg-gray-100 text-left"
          >
            {node.label}
          </button>
        ));
      </div>
    </div>
  );
}
