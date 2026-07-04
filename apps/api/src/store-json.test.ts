import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { UiSchema } from "@cherryflow/ui-schema";
import { createJsonStore } from "./store-json.js";

const schema: UiSchema = {
  version: "1.0",
  workflowId: "report-generator",
  meta: { name: "Report" },
  theme: {
    primaryColor: "#1769e0",
    backgroundColor: "#eef5ff",
    surfaceColor: "#ffffff",
    textColor: "#12213a",
    radius: "large",
    density: "comfortable",
  },
  page: {
    title: "Report",
    layout: "centered",
    components: [
      { id: "form", type: "workflow-form", fields: ["projectName"], submitLabel: "Run" },
      { id: "output", type: "workflow-output", bindings: ["summary"] },
    ],
  },
};

test("json store preserves version, publish, and run behavior", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cherryflow-store-"));
  const store = createJsonStore(join(directory, "cherryflow.json"));

  const draft = await store.saveVersion("report-generator", schema, "Build report");
  assert.equal(draft.status, "draft");
  assert.deepEqual(await store.getVersion(draft.id), draft);

  const published = await store.publishSchema("report-generator", schema, "Publish report", "My Report App");
  assert.equal(published.app.slug, "my-report-app");
  assert.equal((await store.getPublishedApp("My Report App"))?.version.id, published.version.id);

  const versions = await store.listVersions("report-generator");
  assert.deepEqual(new Set(versions.map((version) => version.id)), new Set([draft.id, published.version.id]));

  const run = await store.createRun("report-generator", { projectName: "July" });
  const completed = await store.updateRun(run.id, {
    status: "completed",
    outputs: { summary: "Done" },
  });

  assert.equal(completed?.status, "completed");
  assert.equal(completed?.outputs?.summary, "Done");
  assert.deepEqual(await store.getRun(run.id), completed);
  assert.equal((await store.health()).status, "ok");
});
