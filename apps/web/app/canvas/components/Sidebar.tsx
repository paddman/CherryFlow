'use client';

import { useMemo, useState } from 'react';

export interface ModuleItem {
  type: string;
  label: string;
  description: string;
}

interface SidebarProps {
  modules: ModuleItem[];
  onAddNode: (moduleType: string, label: string) => void;
}

function moduleCategory(type: string) {
  const [category] = type.split('.');
  return category || 'module';
}

export function Sidebar({ modules, onAddNode }: SidebarProps) {
  const [query, setQuery] = useState('');
  const filteredModules = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return modules;
    return modules.filter((module) => `${module.label} ${module.type} ${module.description}`.toLocaleLowerCase().includes(normalized));
  }, [modules, query]);

  return (
    <aside className="canvasSidebar" aria-label="Module palette">
      <div className="canvasBrand">
        <a href="/" className="canvasBrandMark" aria-label="CherryFlow overview">CF</a>
        <div><strong>CherryFlow</strong><small>Workflow Canvas</small></div>
      </div>

      <nav className="canvasNav" aria-label="Canvas navigation">
        <a href="/builder/report-generator">Builder</a>
        <a href="/canvas" aria-current="page">Canvas</a>
        <a href="/models">Models</a>
      </nav>

      <div className="paletteHeading">
        <p className="eyebrow">Module palette</p>
        <div><h2>Build the graph</h2><span>{modules.length} modules</span></div>
        <p className="muted">ลาก node ลง canvas หรือกดเพื่อเพิ่ม แล้วเชื่อมเป็น execution DAG</p>
      </div>

      <label className="moduleSearch">
        <span className="srOnly">Search modules</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search modules…" />
        {query && <button type="button" aria-label="Clear module search" onClick={() => setQuery('')}>×</button>}
      </label>

      <div className="moduleList" aria-live="polite">
        {filteredModules.map((module) => (
          <button
            key={module.type}
            type="button"
            draggable
            onClick={() => onAddNode(module.type, module.label)}
            onDragStart={(event) => {
              event.dataTransfer.setData('application/cherryflow-module', JSON.stringify(module));
              event.dataTransfer.effectAllowed = 'move';
            }}
            className="moduleCard"
          >
            <span className="moduleIcon" aria-hidden="true">{moduleCategory(module.type).slice(0, 2).toUpperCase()}</span>
            <span className="moduleCopy">
              <span><strong>{module.label}</strong><em>{moduleCategory(module.type)}</em></span>
              <code>{module.type}</code>
              <small>{module.description}</small>
            </span>
            <b aria-hidden="true">＋</b>
          </button>
        ))}
        {filteredModules.length === 0 && (
          <div className="moduleEmpty"><strong>No matching modules</strong><span>ลองค้นด้วยชื่อ module หรือ namespace</span></div>
        )}
      </div>

      <footer className="canvasSidebarFooter">
        <span>Drag, configure, validate, run</span>
        <kbd>⌘S</kbd>
      </footer>
    </aside>
  );
}
