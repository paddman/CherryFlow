"use client";

import type { FileOutputValue, WorkflowOutputValue } from "@cherryflow/ui-schema";

function isFile(value: WorkflowOutputValue): value is FileOutputValue {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && "dataUrl" in value);
}

export function RuntimeOutput({ value }: { value: WorkflowOutputValue | undefined }) {
  if (value == null) return <span className="muted">ไม่มีข้อมูล</span>;
  if (isFile(value)) return <a className="downloadButton" href={value.dataUrl} download={value.name}>ดาวน์โหลด {value.name}</a>;
  if (Array.isArray(value)) {
    const columns = value[0] ? Object.keys(value[0]) : [];
    return (
      <div className="tableWrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{value.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{String(row[column] ?? "")}</td>)}</tr>)}</tbody>
      </table></div>
    );
  }
  return <div className="markdownOutput">{String(value)}</div>;
}
