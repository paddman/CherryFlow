import assert from "node:assert/strict";
import test from "node:test";
import { validateWorkflowGraph } from "@cherryflow/workflow-engine";
import { moduleRegistry } from "./module-registry.js";
import { notificationWorkflowDefinitions } from "./notification-workflows.js";

test("ships runnable Telegram, Discord, LINE, and multi-channel templates", () => {
  assert.deepEqual(
    notificationWorkflowDefinitions.map((definition) => definition.contract.id),
    [
      "telegram-notification",
      "discord-webhook-notification",
      "line-oa-push-notification",
      "multi-channel-notification",
    ],
  );

  for (const definition of notificationWorkflowDefinitions) {
    const validation = validateWorkflowGraph(definition.graph, moduleRegistry);
    assert.equal(validation.valid, true, `${definition.contract.id}: ${validation.errors.join("; ")}`);
    assert.equal(definition.template?.category, "integrations");
    assert.ok(definition.contract.inputs.some((input) => input.name === "confirmSend"));
    assert.equal(definition.contract.inputs.some((input) => /token|webhook/i.test(input.name)), false);
  }
});
