"use client";

import type { CSSProperties } from "react";
import type { FileOutputValue, ReportPreviewValue, WorkflowOutputValue } from "@cherryflow/ui-schema";

function isFile(value: WorkflowOutputValue): value is FileOutputValue {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && ("dataUrl" in value || "url" in value));
}

function isReport(value: WorkflowOutputValue): value is ReportPreviewValue {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && "kind" in value && value.kind === "report");
}

function markdownLines(markdown: string): string[] {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .split(/\r?\n/)
    .map((line) => line.replace(/^- /, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function maxChartValue(data: Array<{ value: number }>): number {
  return Math.max(...data.map((item) => Math.abs(item.value)), 1);
}

function ChartPreview({ chart }: { chart: ReportPreviewValue["charts"][number] }) {
  const max = maxChartValue(chart.data);
  return (
    <article className="reportChart">
      <h5>{chart.title}</h5>
      <p>{chart.insight}</p>
      <div className="reportBars">
        {chart.data.slice(0, 8).map((item) => {
          const width = Math.max(4, Math.round(Math.abs(item.value) / max * 100));
          return (
            <div className="reportBar" key={`${chart.id}-${item.label}`}>
              <span>{item.label}</span>
              <div><i style={{ width: `${width}%` }} /></div>
              <strong>{item.value.toLocaleString("th-TH")}</strong>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function ReportTablePreview({ table }: { table: ReportPreviewValue["tables"][number] }) {
  if (table.rows.length === 0) return null;
  return (
    <section className="reportSection reportTableSection">
      <h4>{table.title}</h4>
      <div className="tableWrap">
        <table>
          <thead><tr>{table.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
          <tbody>
            {table.rows.slice(0, 8).map((row, index) => (
              <tr key={index}>{table.columns.map((column) => <td key={column}>{String(row[column] ?? "")}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReportFlowPreview({ flow }: { flow: NonNullable<ReportPreviewValue["flow"]> }) {
  if (!flow.nodes.length) return null;
  const labelById = new Map(flow.nodes.map((node) => [node.id, node.label]));
  return (
    <section className="reportFlow" id="workflow-flow">
      <div className="reportFlowHeader">
        <span>CherryFlow pipeline</span>
        <h4>{flow.title}</h4>
        <p>{flow.description}</p>
      </div>
      <div className="reportFlowTrack">
        {flow.nodes.map((node, index) => (
          <article className={`reportFlowNode flow-${node.status}`} key={node.id}>
            <span className="reportFlowIndex">{index + 1}</span>
            <small>{node.kind}</small>
            <strong>{node.label}</strong>
            <p>{node.detail}</p>
            <em>{node.status}</em>
          </article>
        ))}
      </div>
      {flow.edges.length > 0 && (
        <div className="reportFlowEdges">
          {flow.edges.map((edge) => (
            <span key={`${edge.from}-${edge.to}`}>{labelById.get(edge.from) ?? edge.from} → {labelById.get(edge.to) ?? edge.to}{edge.label ? ` · ${edge.label}` : ""}</span>
          ))}
        </div>
      )}
    </section>
  );
}

function ReportPreview({ report }: { report: ReportPreviewValue }) {
  const summary = markdownLines(report.summaryMarkdown);
  const style = {
    "--report-accent": report.theme?.accentColor ?? "#1769e0",
    "--report-dark": report.theme?.accentDark ?? "#102a5f",
    "--report-bg": report.theme?.backgroundColor ?? "#eef5ff",
  } as CSSProperties;
  return (
    <article className={`reportPreview reportTemplate-${report.template}`} style={style}>
      <header className="reportHero">
        <div>
          <p className="reportEyebrow">{report.theme?.name ?? "AI Generated Report"}</p>
          <h3>{report.title}</h3>
          <p>{report.subtitle}</p>
        </div>
        <span className="reportFormat">{report.outputFormat.toUpperCase()}</span>
      </header>

      <div className="reportMeta">
        <span>หน่วยงาน: {report.department}</span>
        <span>ผู้อ่าน: {report.audience}</span>
        <span>ไฟล์: {report.fileName}</span>
        <span>สร้างเมื่อ: {formatDate(report.generatedAt)}</span>
      </div>

      <nav className="reportToc">
        {report.tableOfContents.map((item) => <a key={item.id} href={`#${item.id}`}>{item.title}</a>)}
      </nav>

      <section className="reportDashboard" id="dashboard">
        <h4>Executive Dashboard</h4>
        <div className="reportMetricGrid">
          {report.kpis.map((item, index) => (
            <div className={`reportMetricCard tone-${item.tone}`} key={`${item.label}-${index}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </div>
          ))}
        </div>
        {report.charts.length > 0 && <div className="reportChartGrid">{report.charts.map((chart) => <ChartPreview key={chart.id} chart={chart} />)}</div>}
      </section>

      {report.flow && <ReportFlowPreview flow={report.flow} />}

      <section className="reportSection">
        <h4>บทสรุปผู้บริหาร</h4>
        {summary.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
      </section>

      <div className="reportSectionStack">
        {report.sections.map((section) => (
          <section className="reportSection" id={section.id} key={section.id}>
            <h4>{section.title}</h4>
            <p>{section.body}</p>
            <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        ))}
      </div>

      {report.tables.map((table) => <ReportTablePreview key={table.title} table={table} />)}

      <div className="reportColumns" id="recommendations">
        <section className="reportSection">
          <h4>ข้อเสนอแนะ</h4>
          <div className="reportCardsList">{report.recommendations.map((item) => (
            <article key={`${item.priority}-${item.title}`}><span>{item.priority}</span><strong>{item.title}</strong><p>{item.detail}</p></article>
          ))}</div>
        </section>
        <section className="reportSection">
          <h4>Risk & Caveats</h4>
          <div className="reportCardsList">{report.risks.map((item) => (
            <article key={`${item.level}-${item.title}`}><span>{item.level}</span><strong>{item.title}</strong><p>{item.mitigation}</p></article>
          ))}</div>
        </section>
      </div>

      {report.notes && <section className="reportNote"><strong>โจทย์จากผู้ใช้:</strong> {report.notes}</section>}
      <details className="reportAppendix" id="appendix">
        <summary>Appendix · {report.appendix.dataShape} · {report.aiStatus}</summary>
        <pre>{report.appendix.sourcePreview}</pre>
      </details>
    </article>
  );
}

export function RuntimeOutput({ value }: { value: WorkflowOutputValue | undefined }) {
  if (value == null) return <span className="muted">ไม่มีข้อมูล</span>;
  if (isReport(value)) return <ReportPreview report={value} />;
  if (isFile(value)) return <a className="downloadButton" href={value.url ?? value.dataUrl} download={value.name}>ดาวน์โหลด {value.name}</a>;
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
