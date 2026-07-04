import assert from "node:assert/strict";
import test from "node:test";
import { runOpenAiToolLoop } from "./agent-loop.js";
import { CherryToolRegistry } from "./tool-registry.js";

function modelResponse(message: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ choices: [{ message }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("executes a tool call, returns the result to the model, and continues to a final answer", async () => {
  const registry = new CherryToolRegistry().register({
    name: "host_status",
    description: "Read host status.",
    inputSchema: {
      type: "object",
      properties: { host: { type: "string" } },
      required: ["host"],
      additionalProperties: false,
    },
    riskLevel: "read",
    run: (arguments_) => ({ host: arguments_.host, status: "healthy" }),
  });

  const requestBodies: Array<Record<string, unknown>> = [];
  const responses = [
    modelResponse({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call-1",
          type: "function",
          function: { name: "host_status", arguments: '{"host":"server-01"}' },
        },
      ],
    }),
    modelResponse({ role: "assistant", content: "server-01 is healthy" }),
  ];

  const fetchImpl: typeof fetch = async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const response = responses.shift();
    if (!response) throw new Error("Unexpected model request");
    return response;
  };

  const result = await runOpenAiToolLoop({
    prompt: "Check server-01",
    registry,
    allowedTools: ["host_status"],
    baseUrl: "http://model.test/v1",
    model: "qwen-test",
    fetchImpl,
  });

  assert.equal(result.answer, "server-01 is healthy");
  assert.equal(result.iterations, 2);
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0]?.status, "completed");
  assert.deepEqual(result.toolCalls[0]?.result, { host: "server-01", status: "healthy" });
  assert.equal(requestBodies.length, 2);

  const secondMessages = requestBodies[1]?.messages as Array<Record<string, unknown>>;
  assert.equal(secondMessages.at(-1)?.role, "tool");
  assert.match(String(secondMessages.at(-1)?.content), /healthy/);
});

test("returns approval failures to the model without executing a protected tool", async () => {
  let executions = 0;
  const registry = new CherryToolRegistry().register({
    name: "vm_restart",
    description: "Restart a virtual machine.",
    inputSchema: {
      type: "object",
      properties: { vmId: { type: "string" } },
      required: ["vmId"],
      additionalProperties: false,
    },
    riskLevel: "write",
    run: () => {
      executions += 1;
      return { restarted: true };
    },
  });

  const responses = [
    modelResponse({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call-protected",
          type: "function",
          function: { name: "vm_restart", arguments: '{"vmId":"100"}' },
        },
      ],
    }),
    modelResponse({ role: "assistant", content: "The restart requires approval." }),
  ];

  const result = await runOpenAiToolLoop({
    prompt: "Restart VM 100",
    registry,
    allowedTools: ["vm_restart"],
    baseUrl: "http://model.test/v1",
    model: "qwen-test",
    fetchImpl: async () => {
      const response = responses.shift();
      if (!response) throw new Error("Unexpected model request");
      return response;
    },
  });

  assert.equal(executions, 0);
  assert.equal(result.toolCalls[0]?.status, "failed");
  assert.match(result.toolCalls[0]?.error ?? "", /Approval required/);
  assert.equal(result.answer, "The restart requires approval.");
});

test("stops when the model exceeds the configured iteration limit", async () => {
  const registry = new CherryToolRegistry().register({
    name: "ping",
    description: "Return pong.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    riskLevel: "read",
    run: () => ({ pong: true }),
  });

  await assert.rejects(
    runOpenAiToolLoop({
      prompt: "Keep pinging",
      registry,
      allowedTools: ["ping"],
      maxIterations: 2,
      baseUrl: "http://model.test/v1",
      model: "qwen-test",
      fetchImpl: async () =>
        modelResponse({
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: crypto.randomUUID(),
              type: "function",
              function: { name: "ping", arguments: "{}" },
            },
          ],
        }),
    }),
    /exceeded the maximum of 2 model iterations/,
  );
});
