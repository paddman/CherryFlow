import assert from "node:assert/strict";
import test from "node:test";
import { parseOpenAiJson } from "./provider-openai.js";

test("parses plain JSON model output", () => {
  assert.deepEqual(parseOpenAiJson('{"status":"ready"}'), { status: "ready" });
});

test("parses JSON wrapped in a Markdown fence", () => {
  assert.deepEqual(parseOpenAiJson('```json\n{"status":"ready"}\n```'), { status: "ready" });
});

test("extracts a JSON object from surrounding text", () => {
  assert.deepEqual(parseOpenAiJson('Result:\n{"status":"ready"}\nDone.'), { status: "ready" });
});
