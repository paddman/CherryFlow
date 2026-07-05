import assert from "node:assert/strict";
import test from "node:test";
import { decodeStoredFileName, encodeStoredFileName } from "./file-storage.js";

test("encodes non-ASCII filenames into safe S3 metadata values", () => {
  const fileName = "รายงานยอดขายประจำเดือน.pdf";
  const encoded = encodeStoredFileName(fileName);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.equal(decodeStoredFileName(encoded), fileName);
});

test("returns undefined for absent encoded filenames", () => {
  assert.equal(decodeStoredFileName(undefined), undefined);
});
