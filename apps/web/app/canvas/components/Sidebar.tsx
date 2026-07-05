'use client';

export interface ModuleItem {
  type: string;
  label: string;
  description: string;
}

interface SidebarProps {
  modules: ModuleItem[];
  onAddNode: (moduleType: string, label: string) => void;
}

export function Sidebar({ modules, onAddNode }: SidebarProps) {
  return (
    <aside className="canvasSidebar">
      <div>
        <p className="eyebrow">Module Palette</p>
        <h2>ลาก node ลง Canvas</h2>
        <p className="muted">ลากหรือกดเพิ่ม module แล้วเชื่อมเส้นตาม DAG</p>
      </div>
      <div className="moduleList">
        {modules.map((module) => (
          <button
            key={module.type}
            type="button"
            draggable
            onClick={() => onAddNode(module.type, module.label)}
            onDragStart={(event) => {
              event.dataTransfer.setData("application/cherryflow-module", JSON.stringify(module));
              event.dataTransfer.effectAllowed = "move";
            }}
            className="moduleCard"
          >
            <strong>{module.label}</strong>
            <code>{module.type}</code>
            <span>{module.description}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
