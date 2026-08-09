import assert from "node:assert/strict";
import test from "node:test";
import { validateWorkflowGraph } from "@cherryflow/workflow-engine";
import { moduleRegistry } from "./module-registry.js";
import { cryptoWorkflowDefinitions } from "./crypto-workflows.js";

test("crypto templates cover discovery, market data, paper trading, private reads, live order, and cancellation", () => {
  const ids = new Set(cryptoWorkflowDefinitions.map((definition) => definition.contract.id));
  assert.equal(cryptoWorkflowDefinitions.length, 9);
  for (const id of [
    "crypto-exchange-catalog",
    "crypto-market-ticker",
    "crypto-ohlcv-history",
    "crypto-portfolio-balance",
    "crypto-open-orders",
    "crypto-paper-order",
    "crypto-live-order",
    "crypto-cancel-order",
  ]) assert.ok(ids.has(id), `missing ${id}`);
});

test("every crypto template has a valid executable graph", () => {
  for (const definition of cryptoWorkflowDefinitions) {
    const validation = validateWorkflowGraph(definition.graph, moduleRegistry);
    assert.equal(validation.valid, true, `${definition.contract.id}: ${validation.errors.join("; ")}`);
  }
});
