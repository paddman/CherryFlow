import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  estimateOrderNotional,
  parseSafeExchangeParams,
  runCryptoCreateOrder,
  runCryptoExchangeCatalog,
  runCryptoPaperOrder,
  setCryptoExchangeCatalogForTests,
  setCryptoExchangeFactoryForTests,
} from "./crypto-exchange.js";

function context(inputs: Record<string, unknown>) {
  return {
    workflowInputs: {},
    config: { inputNode: "input" },
    dependencies: { input: inputs },
  };
}

function fakeFactory(calls: { createOrder: number }) {
  return async () => ({
    id: "fake",
    name: "Fake Exchange",
    has: {
      fetchTicker: true,
      fetchOHLCV: true,
      fetchBalance: true,
      fetchOpenOrders: true,
      createOrder: true,
      cancelOrder: true,
      setLeverage: true,
    },
    loadMarkets: async () => ({
      "BTC/USDT": { symbol: "BTC/USDT", active: true, contractSize: 1 },
    }),
    market: () => ({ symbol: "BTC/USDT", active: true, contractSize: 1 }),
    fetchTicker: async () => ({ symbol: "BTC/USDT", last: 50_000, bid: 49_990, ask: 50_010, timestamp: 1_700_000_000_000 }),
    amountToPrecision: (_symbol: string, amount: number) => amount.toFixed(4),
    priceToPrecision: (_symbol: string, price: number) => price.toFixed(2),
    createOrder: async (symbol: string, type: string, side: string, amount: number, price?: number) => {
      calls.createOrder += 1;
      return { id: "order-1", symbol, type, side, amount, price, status: "open", timestamp: 1_700_000_000_000 };
    },
    close: async () => undefined,
  });
}

afterEach(() => {
  setCryptoExchangeFactoryForTests(undefined);
  setCryptoExchangeCatalogForTests(undefined);
});

test("rejects secrets and withdrawal fields in exchange-specific params", () => {
  assert.deepEqual(parseSafeExchangeParams('{"tdMode":"cross","reduceOnly":true}'), { tdMode: "cross", reduceOnly: true });
  assert.throws(() => parseSafeExchangeParams('{"apiKey":"leak"}'), /not allowed/);
  assert.throws(() => parseSafeExchangeParams('{"nested":{"withdraw":true}}'), /not allowed/);
});

test("estimates quote notional with contract size", () => {
  assert.equal(estimateOrderNotional(2, 100, 0.01), 2);
  assert.throws(() => estimateOrderNotional(0, 100), /invalid/);
});

test("catalog exposes installed adapter exchange ids", async () => {
  setCryptoExchangeCatalogForTests(["binance", "okx", "bybit"]);
  const result = await runCryptoExchangeCatalog(context({ query: "bi" }), {});
  assert.equal(result.status, "catalog-ready");
  assert.deepEqual(result.data.map((row) => row.exchangeId), ["binance", "bybit"]);
});

test("paper order never calls createOrder", async () => {
  const calls = { createOrder: 0 };
  setCryptoExchangeFactoryForTests(fakeFactory(calls));
  const result = await runCryptoPaperOrder(context({
    exchangeId: "fake",
    marketType: "spot",
    sandbox: false,
    symbol: "BTC/USDT",
    side: "buy",
    orderType: "market",
    amount: 0.001,
    leverage: 1,
    reduceOnly: false,
    feeBps: 10,
  }), { CHERRYFLOW_CRYPTO_ALLOWED_EXCHANGES: "fake" });
  assert.equal(result.status, "paper-order");
  assert.equal(calls.createOrder, 0);
  assert.equal(result.data[0]?.estimatedQuoteNotional, 50.01);
});

test("live order is blocked unless every safety gate passes", async () => {
  const calls = { createOrder: 0 };
  setCryptoExchangeFactoryForTests(fakeFactory(calls));
  await assert.rejects(
    runCryptoCreateOrder(context({
      exchangeId: "fake",
      marketType: "spot",
      sandbox: true,
      credentialProfile: "fake",
      symbol: "BTC/USDT",
      side: "buy",
      orderType: "market",
      amount: 0.001,
      leverage: 1,
      approvalReference: "APP-1",
      confirmLiveTrade: true,
    }), { CHERRYFLOW_CRYPTO_ALLOWED_EXCHANGES: "fake" }),
    /Live trading is disabled/,
  );
  assert.equal(calls.createOrder, 0);
});

test("live sandbox order reaches createOrder after approval and risk checks", async () => {
  const calls = { createOrder: 0 };
  setCryptoExchangeFactoryForTests(fakeFactory(calls));
  const result = await runCryptoCreateOrder(context({
    exchangeId: "fake",
    marketType: "spot",
    sandbox: true,
    credentialProfile: "fake",
    symbol: "BTC/USDT",
    side: "buy",
    orderType: "market",
    amount: 0.001,
    leverage: 1,
    reduceOnly: false,
    approvalReference: "APP-1001",
    confirmLiveTrade: true,
  }), {
    CHERRYFLOW_CRYPTO_ALLOWED_EXCHANGES: "fake",
    CHERRYFLOW_CRYPTO_ALLOWED_SYMBOLS: "BTC/USDT",
    CHERRYFLOW_CRYPTO_LIVE_TRADING: "true",
    CHERRYFLOW_CRYPTO_REQUIRE_SANDBOX: "true",
    CHERRYFLOW_CRYPTO_MAX_ORDER_NOTIONAL: "100",
  });
  assert.equal(result.status, "sandbox-order-created");
  assert.equal(calls.createOrder, 1);
  assert.equal(result.data[0]?.id, "order-1");
});
