import { ModuleRegistry, type WorkflowData } from "@cherryflow/workflow-engine";
import type { UploadedFileValue } from "@cherryflow/ui-schema";
import { createCherryAgentModuleDefinition } from "./cherry-agent.js";
import { createFileOutput } from "./file-storage.js";
import { extractFileContent } from "./file-content.js";
import { createOpenClawModuleDefinition } from "./openclaw-module.js";
import { computeMetrics, summarizeReport } from "./report-ai.js";
import { buildReportDocument, normalizeReportTemplate } from "./report-document.js";
import { buildSkillPdfReport, pdfSkillAvailable, pdfSkillScriptPath, reportPdfSkillMode } from "./report-pdf-skill.js";
import { markdownToText, normalizeReportFormat, renderReport } from "./report-renderer.js";

function isUploadedFile(value: unknown): value is UploadedFileValue {
  return Boolean(value && typeof value === "object" && "name" in value && ("dataUrl" in value || "objectKey" in value) && "size" in value);
}

function dependency(dependencies: Record<string, WorkflowData>, nodeId: string): WorkflowData {
  const value = dependencies[nodeId];
  if (!value) throw new Error(`Missing dependency output: ${nodeId}`);
  return value;
}

function outputWithSummaryNote(output: WorkflowData, note: string): WorkflowData {
  const summary = typeof output.summary === "string" ? output.summary : "";
  return {
    ...output,
    qwenPdfStatus: note,
    summary: [summary, "", "---", note].filter(Boolean).join("\n"),
  };
}

export const moduleRegistry = new ModuleRegistry()
  .register({
    type: "core.input",
    label: "Workflow Input",
    description: "Expose validated workflow form values to downstream nodes.",
    run: ({ workflowInputs }) => workflowInputs,
  })
  .register({
    type: "file.inspect",
    label: "Inspect Uploaded File",
    description: "Validate an uploaded file and expose safe metadata.",
    run: ({ dependencies, config }) => {
      const source = dependency(dependencies, String(config.inputNode ?? "input"));
      const field = String(config.field ?? "sourceFile");
      const file = source[field];
      if (!isUploadedFile(file)) throw new Error(`${field} is required`);
      const maxBytes = Number(config.maxBytes ?? 5 * 1024 * 1024);
      if (file.size > maxBytes) throw new Error(`File exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`);
      return { name: file.name, type: file.type, size: file.size };
    },
  })
  .register({
    type: "report.compose",
    label: "Compose Report",
    description: "Extract the uploaded file's real content and compose a data-grounded report.",
    run: async ({ dependencies, config }) => {
      const input = dependency(dependencies, String(config.inputNode ?? "input"));
      const file = dependency(dependencies, String(config.fileNode ?? "inspect"));
      const projectName = String(input.projectName ?? "Untitled project");
      const department = String(input.department ?? "unspecified");
      const notes = String(input.notes ?? "").trim();
      const outputFormat = normalizeReportFormat(input.outputFormat);
      const reportTemplate = normalizeReportTemplate(input.reportTemplate);
      const fileName = String(file.name ?? "source-file");

      const uploaded = input.sourceFile;
      if (!isUploadedFile(uploaded)) throw new Error("sourceFile is required");

      const extracted = await extractFileContent(uploaded);
      const metrics = computeMetrics(extracted, { fileName });
      const { summary, usedAi, fallbackReason } = await summarizeReport({ projectName, department, notes, fileName, extracted, metrics });
      const reportModel = buildReportDocument({
        projectName,
        department,
        notes,
        fileName,
        extracted,
        metrics,
        summaryMarkdown: summary,
        usedAi,
        outputFormat,
        reportTemplate,
        ...(fallbackReason ? { fallbackReason } : {}),
      });
      const report = await renderReport(reportModel, outputFormat);

      const reportText = [
        summary,
        "",
        "## Dashboard KPIs",
        ...reportModel.kpis.map((item) => `- ${item.label}: ${item.value} (${item.detail})`),
        "",
        "## ข้อมูลสำคัญ",
        ...metrics.map((item) => `- ${item.metric}: ${item.value}`),
        "",
        "## Sections",
        ...reportModel.sections.flatMap((section) => [`### ${section.title}`, section.body, ...section.bullets.map((item) => `- ${item}`)]),
        "",
        "## ข้อเสนอแนะ",
        ...reportModel.recommendations.map((item) => `- [${item.priority}] ${item.title}: ${item.detail}`),
        "",
        reportModel.aiStatus,
      ].join("\n");

      return {
        reportPreview: reportModel,
        summary: `${summary}\n\n---\nรายงานที่สร้าง: ${report.fileName}\n\n${markdownToText(reportText).slice(0, 1200)}`,
        metrics,
        reportFile: await createFileOutput(report.fileName, report.mimeType, report.content),
      };
    },
  })
  .register({
    type: "report.qwen_pdf",
    label: "Qwen PDF Skill Renderer",
    description: "For PDF outputs, call skill_pdf's Qwen JSON planner and ReportLab renderer; fallback to the composed report unless required.",
    run: async ({ dependencies, config }) => {
      const input = dependency(dependencies, String(config.inputNode ?? "input"));
      const file = dependency(dependencies, String(config.fileNode ?? "inspect"));
      const composed = dependency(dependencies, String(config.composeNode ?? "compose"));
      const outputFormat = normalizeReportFormat(input.outputFormat);
      if (outputFormat !== "pdf") return composed;

      const mode = reportPdfSkillMode();
      if (mode === "disabled") return outputWithSummaryNote(composed, "Qwen PDF skill skipped: CHERRYFLOW_REPORT_PDF_SKILL is disabled.");

      const scriptPath = pdfSkillScriptPath();
      if (!pdfSkillAvailable(scriptPath)) {
        const message = `Qwen PDF skill script is unavailable: ${scriptPath}`;
        if (mode === "required") throw new Error(message);
        return outputWithSummaryNote(composed, `Qwen PDF skill fallback: ${message}`);
      }

      const uploaded = input.sourceFile;
      if (!isUploadedFile(uploaded)) throw new Error("sourceFile is required");

      const projectName = String(input.projectName ?? "Untitled project");
      const department = String(input.department ?? "unspecified");
      const notes = String(input.notes ?? "").trim();
      const fileName = String(file.name ?? uploaded.name ?? "source-file");
      const extracted = await extractFileContent(uploaded);

      try {
        const skillReport = await buildSkillPdfReport({ projectName, department, notes, fileName, extracted, scriptPath });
        return outputWithSummaryNote({
          ...composed,
          reportFile: await createFileOutput(skillReport.fileName, skillReport.mimeType, skillReport.content),
        }, `Qwen PDF skill rendered: ${skillReport.fileName}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Qwen PDF skill failed";
        if (mode === "required") throw new Error(message);
        return outputWithSummaryNote(composed, `Qwen PDF skill fallback: ${message}`);
      }
    },
  })
  .register(createCherryAgentModuleDefinition())
  .register(createOpenClawModuleDefinition())
  .register({
    type: "core.output",
    label: "Workflow Output",
    description: "Expose one upstream node as the final workflow output.",
    run: ({ dependencies, config }) => dependency(dependencies, String(config.sourceNode ?? "compose")),
  });
