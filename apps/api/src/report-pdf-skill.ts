import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { ExtractedFileContent } from "./file-content.js";

export type ReportPdfSkillMode = "auto" | "disabled" | "required";

export interface SkillPdfReport {
  fileName: string;
  mimeType: "application/pdf";
  content: Buffer;
  diagnostics: string;
}

export interface BuildSkillPdfReportInput {
  projectName: string;
  department: string;
  notes: string;
  fileName: string;
  extracted: ExtractedFileContent;
  env?: NodeJS.ProcessEnv;
  scriptPath?: string;
  pythonBin?: string;
  baseUrl?: string;
  model?: string;
  brand?: "nt" | "thai_nt" | "corporate_blue";
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 180_000;

function envValue(env: NodeJS.ProcessEnv, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function defaultSkillScriptPath(): string {
  return fileURLToPath(new URL("../../../skill_pdf/run_report.py", import.meta.url));
}

export function reportPdfSkillMode(env: NodeJS.ProcessEnv = process.env): ReportPdfSkillMode {
  const value = (env.CHERRYFLOW_REPORT_PDF_SKILL ?? "auto").trim().toLowerCase();
  if (["0", "false", "off", "no", "disabled"].includes(value)) return "disabled";
  if (["required", "force", "forced"].includes(value)) return "required";
  return "auto";
}

export function pdfSkillScriptPath(env: NodeJS.ProcessEnv = process.env): string {
  return env.CHERRYFLOW_REPORT_PDF_SKILL_PATH?.trim() || defaultSkillScriptPath();
}

export function pdfSkillAvailable(scriptPath = pdfSkillScriptPath()): boolean {
  return existsSync(scriptPath);
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function extractedContentToSkillText(extracted: ExtractedFileContent): string {
  if (extracted.kind === "text") {
    return extracted.truncated ? `${extracted.text}\n\n[TRUNCATED SOURCE]` : extracted.text;
  }

  const rows = [
    extracted.columns.map(csvCell).join(","),
    ...extracted.rows.map((row) => extracted.columns.map((column) => csvCell(row[column])).join(",")),
  ];
  if (extracted.truncated) rows.push("[TRUNCATED SOURCE]");
  return rows.join("\n");
}

export function buildSkillPdfInstruction(input: Pick<BuildSkillPdfReportInput, "projectName" | "department" | "notes" | "fileName">): string {
  return [
    `Create a polished company PDF report for "${input.projectName}".`,
    `Department/audience: ${input.department}.`,
    `Source file: ${input.fileName}.`,
    "Use a professional corporate document style with cover, table of contents, clear sections, KPI/dashboard pages, charts, tables, recommendations, and an execution flow when useful.",
    "Use only facts and numbers present in the supplied data; do not invent statistics.",
    input.notes ? `User notes: ${input.notes}` : "",
  ].filter(Boolean).join("\n");
}

function safeFileStem(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "qwen-report";
}

async function runPython(args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number }): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(args[0] ?? "python3", args.slice(1), {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`Qwen PDF skill timed out after ${options.timeoutMs}ms`));
        return;
      }
      if (code !== 0) {
        const detail = (stderr || stdout || `exit code ${code ?? "unknown"}${signal ? ` signal ${signal}` : ""}`).trim();
        reject(new Error(`Qwen PDF skill failed: ${detail}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export async function buildSkillPdfReport(input: BuildSkillPdfReportInput): Promise<SkillPdfReport> {
  const env = input.env ?? process.env;
  const scriptPath = input.scriptPath ?? pdfSkillScriptPath(env);
  if (!existsSync(scriptPath)) throw new Error(`Qwen PDF skill script not found: ${scriptPath}`);

  const baseUrl = input.baseUrl ?? envValue(env, ["QWEN_BASE_URL", "OPENAI_BASE_URL", "VLLM_BASE_URL"]);
  if (!baseUrl) throw new Error("Qwen PDF skill requires OPENAI_BASE_URL, QWEN_BASE_URL, or VLLM_BASE_URL");

  const model = input.model ?? envValue(env, ["QWEN_MODEL", "OPENAI_MODEL", "VLLM_MODEL"]) ?? "Qwen2.5-72B-Instruct";
  const pythonBin = input.pythonBin ?? env.PYTHON_BIN ?? "python3";
  const brand = input.brand ?? "thai_nt";
  const timeoutMs = input.timeoutMs ?? Number(env.CHERRYFLOW_REPORT_PDF_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

  const tempDir = await mkdtemp(path.join(tmpdir(), "cherryflow-skill-pdf-"));
  try {
    const dataPath = path.join(tempDir, "source.csv");
    const outPath = path.join(tempDir, "report.pdf");
    await writeFile(dataPath, extractedContentToSkillText(input.extracted), "utf8");

    const { stdout, stderr } = await runPython(
      [
        pythonBin,
        scriptPath,
        "--data",
        dataPath,
        "--instruction",
        buildSkillPdfInstruction(input),
        "--out",
        outPath,
        "--brand",
        brand,
        "--base-url",
        baseUrl,
        "--model",
        model,
      ],
      {
        cwd: path.dirname(scriptPath),
        env,
        timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
      },
    );

    const content = await readFile(outPath);
    if (content.byteLength < 4 || content.subarray(0, 4).toString("utf8") !== "%PDF") {
      throw new Error("Qwen PDF skill did not produce a valid PDF file");
    }

    return {
      fileName: `${safeFileStem(input.projectName)}-qwen-report.pdf`,
      mimeType: "application/pdf",
      content,
      diagnostics: [stdout.trim(), stderr.trim()].filter(Boolean).join("\n").slice(0, 2000),
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
