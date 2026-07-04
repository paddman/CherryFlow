import assert from "node:assert/strict";
import test from "node:test";
import { createOpenClawModuleDefinition } from "./openclaw-module.js";

test("runs an OpenClawXCherry agent and returns traceable workflow output", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "http://openclaw.test/api/agents/run");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("x-openclaw-token"), "test-token");

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(body.agentId, "linux-doctor");
    assert.equal(body.prompt, "Inspect the host");
    assert.equal(body.idempotencyKey, "workflow-run-1");
    assert.equal(
      (body.context as { cherryFlow?: { runtime?: string } }).cherryFlow?.runtime,
      "openclawxcherry",
    );

    return new Response(
      JSON.stringify({
        runId: "agent-run-1",
        status: "completed",
        output: { diagnosis: "healthy" },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const module = createOpenClawModuleDefinition({
    OPENCLAW_BRIDGE_URL: "http://openclaw.test",
    OPENCLAW_API_TOKEN: "test-token",
  });

  const output = await module.run({
    workflowInputs: { idempotencyKey: "workflow-run-1", host: "server-01" },
    dependencies: { collect: { cpu: 12 } },
    config: {
      agentId: "linux-doctor",
      prompt: "Inspect the host",
      riskLevel: "read",
    },
  });

  assert.deepEqual(output, {
    diagnosis: "healthy",
    agentRunId: "agent-run-1",
    runtime: "openclawxcherry",
    status: "completed",
  });
});

test("requires an approval reference for protected agent actions", async () => {
  const module = createOpenClawModuleDefinition({
    OPENCLAW_BRIDGE_URL: "http://openclaw.test",
    OPENCLAW_API_TOKEN: "test-token",
  });

  await assert.rejects(
    async () => {
      await module.run({
        workflowInputs: {},
        dependencies: {},
        config: {
          prompt: "Apply the approved configuration change",
          requiresApproval: true,
          riskLevel: "write",
        },
      });
    },
    /requires an approvalId/,
  );
});
