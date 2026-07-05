import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { extractFileContent } from "./file-content.js";

function toDataUrl(text: string, mime: string): string {
  return `data:${mime};base64,${Buffer.from(text, "utf8").toString("base64")}`;
}

test("extracts rows from a CSV file, including quoted commas", async () => {
  const csv = 'name,amount\n"Somchai, Ltd.",1200\nSomsri,850\n';
  const result = await extractFileContent({ name: "sales.csv", type: "text/csv", size: csv.length, dataUrl: toDataUrl(csv, "text/csv") });
  assert.equal(result.kind, "rows");
  if (result.kind !== "rows") return;
  assert.deepEqual(result.columns, ["name", "amount"]);
  assert.deepEqual(result.rows, [
    { name: "Somchai, Ltd.", amount: 1200 },
    { name: "Somsri", amount: 850 },
  ]);
});

test("extracts rows from an uploaded xlsx workbook", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.addRow(["department", "budget"]);
  sheet.addRow(["operations", 5000]);
  sheet.addRow(["technology", 7200]);
  const buffer = await workbook.xlsx.writeBuffer();
  const dataUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${Buffer.from(buffer).toString("base64")}`;

  const result = await extractFileContent({ name: "budget.xlsx", type: "", size: buffer.byteLength, dataUrl });
  assert.equal(result.kind, "rows");
  if (result.kind !== "rows") return;
  assert.deepEqual(result.columns, ["department", "budget"]);
  assert.deepEqual(result.rows, [
    { department: "operations", budget: 5000 },
    { department: "technology", budget: 7200 },
  ]);
});

test("falls back to namespaced worksheet XML and selects the data sheet", async () => {
  const zip = new JSZip();
  zip.file("xl/workbook.xml", `<?xml version="1.0"?><x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheets><x:sheet name="Dashboard" sheetId="1"/><x:sheet name="Sales_Data" sheetId="2"/></x:sheets></x:workbook>`);
  zip.file("xl/sharedStrings.xml", `<?xml version="1.0"?><x:sst xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:si><x:t>Revenue</x:t></x:si></x:sst>`);
  zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData><x:row r="1"><x:c r="A1" t="str"><x:v>Dashboard Title</x:v></x:c><x:c r="B1" t="str"><x:v>Dashboard Title</x:v></x:c></x:row></x:sheetData></x:worksheet>`);
  zip.file("xl/worksheets/sheet2.xml", `<?xml version="1.0"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData><x:row r="1"><x:c r="A1" t="str"><x:v>Region</x:v></x:c><x:c r="B1" t="s"><x:v>0</x:v></x:c></x:row><x:row r="2"><x:c r="A2" t="str"><x:v>North</x:v></x:c><x:c r="B2"><x:v>1200</x:v></x:c></x:row></x:sheetData></x:worksheet>`);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const dataUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${buffer.toString("base64")}`;

  const result = await extractFileContent({ name: "namespaced.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: buffer.byteLength, dataUrl });
  assert.equal(result.kind, "rows");
  if (result.kind !== "rows") return;
  assert.deepEqual(result.columns, ["Region", "Revenue"]);
  assert.deepEqual(result.rows, [{ Region: "North", Revenue: 1200 }]);
});

test("falls back to plain text for unrecognized file types", async () => {
  const text = "รายงานความคืบหน้าประจำเดือน";
  const result = await extractFileContent({ name: "notes.txt", type: "text/plain", size: text.length, dataUrl: toDataUrl(text, "text/plain") });
  assert.equal(result.kind, "text");
  if (result.kind !== "text") return;
  assert.equal(result.text, text);
});

test("throws when no file is provided", async () => {
  await assert.rejects(() => extractFileContent(undefined));
});
