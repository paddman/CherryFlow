import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

test("operational overview exposes safe platform totals", async () => {
  process.env.CHERRYFLOW_STORE = "json";
  process.env.CHERRYFLOW_DATA_FILE = join(tmpdir(), `cherryflow-overview-${crypto.randomUUID()}.json`);
  process.env.CHERRYFLOW_AI_PROVIDER = "local";
  process.env.CHERRYFLOW_EMBEDDING_PROVIDER = "local";
  process.env.CHERRYFLOW_RUNNER = "in_process";
  delete process.env.DATABASE_URL;
  delete process.env.REDIS_URL;
  delete process.env.S3_ENDPOINT;
  delete process.env.MINIO_ENDPOINT;
  delete process.env.S3_ACCESS_KEY;
  delete process.env.S3_ACCESS_KEY_ID;
  delete process.env.S3_SECRET_KEY;
  delete process.env.S3_SECRET_ACCESS_KEY;

  const { getOperationalOverview } = await import("./overview.js");
  const overview = await getOperationalOverview();

  assert.equal(overview.service, "cherryflow-api");
  assert.equal(overview.runtime.store, "json");
  assert.equal(overview.runtime.runner, "in_process");
  assert.equal(overview.runtime.fileStorage, "inline");
  assert.equal(overview.runtime.memory, "disabled");
  assert.ok(overview.totals.workflows >= 1);
  assert.ok(overview.totals.modules >= 1);
  assert.ok(overview.workflows.some((workflow) => workflow.id === "report-generator"));
  assert.deepEqual(overview.recentVersions, []);
  assert.equal("passwordHash" in overview, false);
});
