import ExcelJS from "exceljs";
import JSZip from "jszip";
import pdfParse from "pdf-parse";
import type { UploadedFileValue } from "@cherryflow/ui-schema";
import { getStoredFile, parseDataUrl } from "./file-storage.js";

export type ExtractedFileContent =
  | { kind: "rows"; columns: string[]; rows: Array<Record<string, string | number | boolean>>; truncated: boolean }
  | { kind: "text"; text: string; truncated: boolean };

const MAX_ROWS = 500;
const MAX_TEXT_CHARS = 20000;

function extensionOf(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  return match ? (match[1] ?? "").toLowerCase() : "";
}

async function readFileBytes(file: UploadedFileValue): Promise<Buffer> {
  if (file.dataUrl) return parseDataUrl(file.dataUrl).bytes;
  if (file.objectKey) {
    const stored = await getStoredFile(file.objectKey);
    if (!stored) throw new Error("Stored file is unavailable");
    return Buffer.from(stored.body);
  }
  throw new Error("Uploaded file has no retrievable content");
}

function parseCsv(text: string): { columns: string[]; rows: Array<Record<string, string>> } {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === undefined) continue;
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else inQuotes = false;
      } else field += char;
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some((cell) => cell !== "")) rows.push(row);

  const [header, ...body] = rows;
  const columns = (header ?? []).map((name, index) => name.trim() || `column_${index + 1}`);
  return {
    columns,
    rows: body.map((cells) => Object.fromEntries(columns.map((name, index) => [name, cells[index] ?? ""]))),
  };
}

function coerceCell(value: string): string | number {
  if (value.trim() === "") return value;
  const numeric = Number(value);
  return Number.isFinite(numeric) && value.trim() === String(numeric) ? numeric : value;
}

function isDateLikeColumn(column: string): boolean {
  return /(^|[_\s-])(date|month|year|วันที่|เดือน|ปี)($|[_\s-])/i.test(column);
}

function excelSerialDate(value: number): string | undefined {
  if (!Number.isFinite(value) || value < 1 || value > 100000) return undefined;
  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(epoch + value * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function coerceCellForColumn(column: string, value: unknown): string | number {
  if (typeof value === "number" && isDateLikeColumn(column)) return excelSerialDate(value) ?? value;
  if (typeof value === "number") return value;
  const coerced = coerceCell(String(value ?? ""));
  if (typeof coerced === "number" && isDateLikeColumn(column)) return excelSerialDate(coerced) ?? coerced;
  return coerced;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function textFromXml(xml: string): string {
  return decodeXml(xml.replace(/<[^>]+>/g, ""));
}

function attribute(xml: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(xml);
  return match?.[1];
}

function columnIndexFromCellRef(ref: string | undefined, fallback: number): number {
  if (!ref) return fallback;
  const letters = ref.match(/^[A-Z]+/i)?.[0]?.toUpperCase();
  if (!letters) return fallback;
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return Math.max(0, index - 1);
}

function extractSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const strings: string[] = [];
  for (const match of xml.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)) {
    const content = match[1] ?? "";
    const textParts = [...content.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((part) => decodeXml(part[1] ?? ""));
    strings.push(textParts.length > 0 ? textParts.join("") : textFromXml(content));
  }
  return strings;
}

function parseWorksheetRows(worksheetXml: string, sharedStrings: string[]): string[][] {
  const rawRows: string[][] = [];
  for (const rowMatch of worksheetXml.matchAll(/<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
    const rowXml = rowMatch[1] ?? "";
    const values: string[] = [];
    let fallbackIndex = 0;
    for (const cellMatch of rowXml.matchAll(/<(?:\w+:)?c\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?c>/g)) {
      const cellAttrs = cellMatch[1] ?? "";
      const cellXml = cellMatch[2] ?? "";
      const columnIndex = columnIndexFromCellRef(attribute(cellAttrs, "r"), fallbackIndex);
      fallbackIndex = columnIndex + 1;
      const type = attribute(cellAttrs, "t");
      const valueXml = cellXml.match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1];
      const inlineXml = cellXml.match(/<(?:\w+:)?is\b[^>]*>([\s\S]*?)<\/(?:\w+:)?is>/)?.[1];
      let value = "";
      if (type === "s" && valueXml !== undefined) value = sharedStrings[Number(valueXml)] ?? "";
      else if (type === "inlineStr" && inlineXml !== undefined) value = textFromXml(inlineXml);
      else if (valueXml !== undefined) value = decodeXml(valueXml);
      values[columnIndex] = value;
    }
    if (values.some((value) => value !== undefined && value !== "")) rawRows.push(values.map((value) => value ?? ""));
  }
  return rawRows;
}

function selectHeaderIndex(rows: string[][]): number {
  const limit = Math.min(rows.length, 25);
  for (let index = 0; index < limit; index += 1) {
    const row = rows[index] ?? [];
    const filled = row.map((cell) => cell.trim()).filter(Boolean);
    const unique = new Set(filled);
    if (filled.length < 2 || unique.size < 2) continue;
    const next = rows.slice(index + 1, index + 6);
    const hasDataBelow = next.some((candidate) => candidate.filter((cell) => cell.trim()).length >= Math.min(2, filled.length));
    if (hasDataBelow) return index;
  }
  return 0;
}

function tableFromRawRows(rawRows: string[][]): { columns: string[]; rows: Array<Record<string, string | number>> } {
  const headerIndex = selectHeaderIndex(rawRows);
  const header = rawRows[headerIndex] ?? [];
  const columns = header.map((name, index) => name.trim() || `column_${index + 1}`);
  const body = rawRows.slice(headerIndex + 1).filter((row) => row.some((cell) => cell.trim()));
  return {
    columns,
    rows: body.map((cells) => Object.fromEntries(columns.map((name, index) => [name, coerceCellForColumn(name, cells[index] ?? "")]))),
  };
}

async function extractSpreadsheetFallback(bytes: Buffer): Promise<{ columns: string[]; rows: Array<Record<string, string | number>> }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new Error("ไฟล์ Excel ไม่ใช่ .xlsx ที่ถูกต้อง หากเป็น .xls กรุณา Save As เป็น .xlsx หรือ CSV ก่อนอัปโหลด");
  }

  const worksheetPaths = Object.keys(zip.files)
    .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(path))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (worksheetPaths.length === 0) throw new Error("ไม่พบ worksheet ในไฟล์ Excel");

  const sharedXml = await zip.file("xl/sharedStrings.xml")?.async("string");
  const sharedStrings = extractSharedStrings(sharedXml);
  const candidates: Array<{ columns: string[]; rows: Array<Record<string, string | number>>; score: number }> = [];

  for (const worksheetPath of worksheetPaths) {
    const worksheetXml = await zip.file(worksheetPath)?.async("string");
    if (!worksheetXml) continue;
    const rawRows = parseWorksheetRows(worksheetXml, sharedStrings);
    if (rawRows.length === 0) continue;
    const table = tableFromRawRows(rawRows);
    const meaningfulColumns = table.columns.filter((column) => column.trim() && !/^column_\d+$/.test(column)).length;
    const score = table.rows.length * Math.max(1, meaningfulColumns);
    if (table.columns.length > 0 && table.rows.length > 0) candidates.push({ ...table, score });
  }

  const selected = candidates.sort((a, b) => b.score - a.score)[0];
  if (!selected) throw new Error("ไม่พบตารางข้อมูลที่อ่านได้ในไฟล์ Excel");
  return { columns: selected.columns, rows: selected.rows };
}

async function extractSpreadsheet(bytes: Buffer): Promise<{ columns: string[]; rows: Array<Record<string, string | number>> }> {
  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs's shipped types predate the generic Buffer<TArrayBuffer> added in newer @types/node,
    // so its declared Buffer parameter type doesn't structurally match ours at the type level.
    await workbook.xlsx.load(bytes as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) return extractSpreadsheetFallback(bytes);

    const header = (sheet.getRow(1).values as Array<string | undefined>).slice(1);
    const columns = header.map((name, index) => (name ?? "").toString().trim() || `column_${index + 1}`);
    const rows: Array<Record<string, string | number>> = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = (row.values as Array<unknown>).slice(1);
      const record: Record<string, string | number> = {};
      columns.forEach((name, index) => {
        const cell = values[index];
        record[name] = coerceCellForColumn(name, cell);
      });
      rows.push(record);
    });
    return { columns, rows };
  } catch (error) {
    try {
      return await extractSpreadsheetFallback(bytes);
    } catch (fallbackError) {
      throw new Error(`อ่านไฟล์ Excel ไม่สำเร็จ: ${fallbackError instanceof Error ? fallbackError.message : error instanceof Error ? error.message : "ไฟล์ไม่รองรับ"}`);
    }
  }
}

export async function extractFileContent(file: UploadedFileValue | undefined): Promise<ExtractedFileContent> {
  if (!file) throw new Error("sourceFile is required");
  const bytes = await readFileBytes(file);
  const ext = extensionOf(file.name || "");
  const type = file.type || "";

  if (ext === "xls") throw new Error("ไฟล์ .xls รุ่นเก่ายังไม่รองรับ กรุณา Save As เป็น .xlsx หรือ CSV ก่อนอัปโหลด");

  if (ext === "xlsx" || type.includes("spreadsheet")) {
    const { columns, rows } = await extractSpreadsheet(bytes);
    return { kind: "rows", columns, rows: rows.slice(0, MAX_ROWS), truncated: rows.length > MAX_ROWS };
  }

  if (ext === "csv" || type.includes("csv")) {
    const { columns, rows } = parseCsv(bytes.toString("utf8"));
    const coerced = rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, coerceCellForColumn(key, value)])));
    return { kind: "rows", columns, rows: coerced.slice(0, MAX_ROWS), truncated: coerced.length > MAX_ROWS };
  }

  if (ext === "pdf" || type === "application/pdf") {
    const parsed = await pdfParse(bytes);
    const text = parsed.text.trim();
    return { kind: "text", text: text.slice(0, MAX_TEXT_CHARS), truncated: text.length > MAX_TEXT_CHARS };
  }

  const text = bytes.toString("utf8");
  return { kind: "text", text: text.slice(0, MAX_TEXT_CHARS), truncated: text.length > MAX_TEXT_CHARS };
}
