import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeSlug } from "./index.js";

test("slug normalization", () => {
  assert.equal(sanitizeSlug("Sales Report 2026"), "sales-report-2026");
});
