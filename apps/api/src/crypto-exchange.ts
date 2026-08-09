import type { ModuleContext, ModuleDefinition, WorkflowData } from "@cherryflow/workflow-engine";

export type CryptoTableRow = Record<string, string | number | boolean>;

export interface CryptoModuleOutput extends WorkflowData {
  result: string;
  summary: string;
  data: CryptoTableRow[];
  riskChecks: CryptoTableRow[];
  status: string;
}

type CryptoMarketType = "spot" | "margin" | "swap" | "future" | "option";
type CryptoOrderSide = "buy" | "sell";
type CryptoOrderType = "market" | "limit";

type CryptoExchange = {
  id?: string;
  name?: string;
  has?: Record<string, unknown>;
  markets?: Record<string, Record<string, unknown>>;
  loadMarkets: (reload?: boolean) => Promise<Record<string, Record<string, unknown>>>;
  setSandboxMode?: (enabled: boolean) => void;
  fetchTicker?: (symbol: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  fetchOHLCV?: (symbol: string, timeframe?: string, since?: number, limit?: number, params?: Record<string, unknown>) => Promise<unknown[][]>;
  fetchBalance?: (params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  fetchOpenOrders?: (symbol?: string, since?: number, limit?: number, params?: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
  createOrder?: (
    symbol: string,
    type: CryptoOrderType,
    side: CryptoOrderSide,
    amount: number,
    price?: number,
    params?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  cancelOrder?: (orderId: string, symbol?: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  setLeverage?: (leverage: number, symbol?: string, params?: Record<string, unknown>) => Promise<unknown>;
  amountToPrecision?: (symbol: string, amount: number) => string;
  priceToPrecision?: (symbol: string, price: number) => string;
  market?: (symbol: string) => Record<string, unknown>;
  close?: () => Promise<void>;
};

type ExchangeFactoryRequest = {
  exchangeId: string;
  marketType: CryptoMarketType;
  sandbox: boolean;
  credentialProfile?: string;
  requiresPrivate: boolean;
};

export type CryptoExchangeFactory = (
  request: ExchangeFactoryRequest,
  env: NodeJS.ProcessEnv,
) => Promise<CryptoExchange>;

type CcxtModule = Record<string, unknown> & {
  default?: Record<string, unknown>;
  exchanges?: string[];
  version?: string;
};

const MARKET_TYPES = new Set<CryptoMarketType>(["spot", "margin", "swap", "future", "option"]);
const FORBIDDEN_PARAM_KEY = /(api.?key|secret|password|token|private.?key|seed|mnemonic|withdraw)/i;
const EXCHANGE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const SYMBOL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_./:-]{1,79}$/;
const PROFILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const MAX_CATALOG_ROWS = 500;

let factoryOverride: CryptoExchangeFactory | undefined;
let catalogOverride: string[] | undefined;
let ccxtModulePromise: Promise<CcxtModule> | undefined;

export function setCryptoExchangeFactoryForTests(factory?: CryptoExchangeFactory): void {
  factoryOverride = factory;
}

export function setCryptoExchangeCatalogForTests(exchangeIds?: string[]): void {
  catalogOverride = exchangeIds;
}

function cleanText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function cleanBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return ["1", "true", "yes", "on"].includes(cleanText(value).toLowerCase());
}

function cleanNumber(value: unknown, fallback?: number): number {
  const number = typeof value === "number" ? value : Number(cleanText(value));
  if (Number.isFinite(number)) return number;
  if (fallback !== undefined) return fallback;
  throw new Error(`Expected a finite number, received ${String(value)}`);
}

function envBoolean(env: NodeJS.ProcessEnv, key: string, fallback: boolean): boolean {
  const value = env[key]?.trim();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function envNumber(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const value = Number(env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function dependency(context: ModuleContext, nodeId: string): WorkflowData {
  const value = context.dependencies[nodeId];
  if (!value) throw new Error(`Missing dependency output: ${nodeId}`);
  return value;
}

function inputValues(context: ModuleContext): WorkflowData {
  return dependency(context, cleanText(context.config.inputNode, "input"));
}

function normalizeExchangeId(value: unknown): string {
  const exchangeId = cleanText(value).toLowerCase();
  if (!EXCHANGE_ID_PATTERN.test(exchangeId)) throw new Error("exchangeId is invalid");
  return exchangeId;
}

function normalizeProfile(value: unknown, exchangeId: string): string {
  const profile = cleanText(value, exchangeId);
  if (!PROFILE_PATTERN.test(profile)) throw new Error("credentialProfile is invalid");
  return profile;
}

function normalizeSymbol(value: unknown): string {
  const symbol = cleanText(value);
  if (!SYMBOL_PATTERN.test(symbol)) throw new Error("symbol is invalid");
  return symbol;
}

function normalizeMarketType(value: unknown): CryptoMarketType {
  const marketType = cleanText(value, "spot").toLowerCase() as CryptoMarketType;
  if (!MARKET_TYPES.has(marketType)) throw new Error(`Unsupported marketType: ${marketType}`);
  return marketType;
}

function csvSet(value: string | undefined): Set<string> | undefined {
  const items = value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
  return items.length > 0 ? new Set(items) : undefined;
}

function assertExchangeAllowed(exchangeId: string, env: NodeJS.ProcessEnv): void {
  const allowed = csvSet(env.CHERRYFLOW_CRYPTO_ALLOWED_EXCHANGES?.toLowerCase());
  if (allowed && !allowed.has(exchangeId)) throw new Error(`Exchange is not allowlisted: ${exchangeId}`);
}

function assertSymbolAllowed(symbol: string, env: NodeJS.ProcessEnv): void {
  const allowed = csvSet(env.CHERRYFLOW_CRYPTO_ALLOWED_SYMBOLS?.toUpperCase());
  if (allowed && !allowed.has(symbol.toUpperCase())) throw new Error(`Symbol is not allowlisted: ${symbol}`);
}

function parseJsonObject(value: unknown, label: string): Record<string, unknown> {
  if (value == null || cleanText(value) === "") return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") throw new Error(`${label} must be a JSON object`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${label} must be a JSON object`);
  return parsed as Record<string, unknown>;
}

function scanForbiddenKeys(value: unknown, path = "params", depth = 0): void {
  if (depth > 6) throw new Error("Exchange params are nested too deeply");
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbiddenKeys(item, `${path}[${index}]`, depth + 1));
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_PARAM_KEY.test(key)) throw new Error(`Secret or withdrawal field is not allowed in ${path}.${key}`);
    scanForbiddenKeys(nested, `${path}.${key}`, depth + 1);
  }
}

export function parseSafeExchangeParams(value: unknown): Record<string, unknown> {
  const params = parseJsonObject(value, "paramsJson");
  scanForbiddenKeys(params);
  return params;
}

function envKeyPart(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function firstEnv(env: NodeJS.ProcessEnv, names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function exchangeCredentials(exchangeId: string, profile: string, env: NodeJS.ProcessEnv): Record<string, string> {
  const exchange = envKeyPart(exchangeId);
  const profileKey = envKeyPart(profile);
  const prefixes = [`CHERRYFLOW_CRYPTO_PROFILE_${profileKey}`, `CHERRYFLOW_CRYPTO_${exchange}`, exchange];
  const lookup = (aliases: string[]) => firstEnv(env, prefixes.flatMap((prefix) => aliases.map((alias) => `${prefix}_${alias}`)));
  const credentials: Record<string, string> = {};
  const apiKey = lookup(["API_KEY", "APIKEY"]);
  const secret = lookup(["SECRET", "API_SECRET"]);
  const password = lookup(["PASSWORD", "PASSPHRASE"]);
  const uid = lookup(["UID"]);
  const walletAddress = lookup(["WALLET_ADDRESS"]);
  const privateKey = lookup(["PRIVATE_KEY"]);
  if (apiKey) credentials.apiKey = apiKey;
  if (secret) credentials.secret = secret;
  if (password) credentials.password = password;
  if (uid) credentials.uid = uid;
  if (walletAddress) credentials.walletAddress = walletAddress;
  if (privateKey) credentials.privateKey = privateKey;
  return credentials;
}

function hasPrivateCredentials(credentials: Record<string, string>): boolean {
  return Boolean(credentials.apiKey || credentials.privateKey);
}

async function loadCcxtModule(env: NodeJS.ProcessEnv): Promise<CcxtModule> {
  if (ccxtModulePromise) return ccxtModulePromise;
  const specifier = env.CHERRYFLOW_CRYPTO_CCXT_PACKAGE?.trim() || "ccxt";
  const dynamicImport = new Function("specifier", "return import(specifier)") as (name: string) => Promise<CcxtModule>;
  ccxtModulePromise = dynamicImport(specifier).catch((error: unknown) => {
    ccxtModulePromise = undefined;
    const detail = error instanceof Error ? error.message : "module import failed";
    throw new Error(`CCXT is not installed (${detail}). Run: pnpm --filter @cherryflow/api add ccxt`);
  });
  return ccxtModulePromise;
}

function ccxtRoot(module: CcxtModule): Record<string, unknown> {
  return module.default && typeof module.default === "object" ? module.default : module;
}

async function defaultExchangeFactory(request: ExchangeFactoryRequest, env: NodeJS.ProcessEnv): Promise<CryptoExchange> {
  assertExchangeAllowed(request.exchangeId, env);
  const module = await loadCcxtModule(env);
  const root = ccxtRoot(module);
  const candidate = root[request.exchangeId] ?? module[request.exchangeId];
  if (typeof candidate !== "function") throw new Error(`CCXT exchange is not available: ${request.exchangeId}`);

  const credentials = exchangeCredentials(request.exchangeId, request.credentialProfile ?? request.exchangeId, env);
  if (request.requiresPrivate && !hasPrivateCredentials(credentials)) {
    throw new Error(`Private API credentials are not configured for profile ${request.credentialProfile ?? request.exchangeId}`);
  }

  const timeout = Math.max(1_000, envNumber(env, "CHERRYFLOW_CRYPTO_TIMEOUT_MS", 15_000));
  const exchange = new (candidate as new (config: Record<string, unknown>) => CryptoExchange)({
    enableRateLimit: true,
    timeout,
    ...credentials,
    options: {
      defaultType: request.marketType,
      adjustForTimeDifference: true,
    },
  });
  if (request.sandbox) {
    if (!exchange.setSandboxMode) throw new Error(`${request.exchangeId} does not expose CCXT sandbox mode`);
    exchange.setSandboxMode(true);
  }
  await exchange.loadMarkets(false);
  return exchange;
}

async function createExchange(request: ExchangeFactoryRequest, env: NodeJS.ProcessEnv): Promise<CryptoExchange> {
  assertExchangeAllowed(request.exchangeId, env);
  return (factoryOverride ?? defaultExchangeFactory)(request, env);
}

async function withExchange<T>(
  request: ExchangeFactoryRequest,
  env: NodeJS.ProcessEnv,
  operation: (exchange: CryptoExchange) => Promise<T>,
): Promise<T> {
  const exchange = await createExchange(request, env);
  try {
    return await operation(exchange);
  } finally {
    await exchange.close?.().catch(() => undefined);
  }
}

function capability(exchange: CryptoExchange, method: string): boolean {
  const declared = exchange.has?.[method];
  if (declared === false || declared === undefined) return false;
  return declared === true || declared === "emulated";
}

function requireMethod<T>(value: T | undefined, label: string): T {
  if (!value) throw new Error(`Exchange does not support ${label}`);
  return value;
}

function cell(value: unknown): string | number | boolean {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value).slice(0, 1_000);
}

function isoTime(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  const text = cleanText(value);
  return text || "";
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/([A-Za-z0-9_-]{12,}):[A-Za-z0-9_-]{20,}/g, "[redacted-token]")
    .replace(/(api[_ -]?key|secret|password|token|private[_ -]?key)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 1_200);
}

function checks(...items: Array<[string, boolean, string]>): CryptoTableRow[] {
  return items.map(([check, passed, detail]) => ({
    check,
    status: passed ? "passed" : "blocked",
    detail,
  }));
}

function output(
  status: string,
  result: string,
  summary: string,
  data: CryptoTableRow[],
  riskChecks: CryptoTableRow[] = [],
): CryptoModuleOutput {
  return { status, result, summary, data, riskChecks };
}

function sessionFromInputs(inputs: WorkflowData, requiresPrivate: boolean): ExchangeFactoryRequest {
  const exchangeId = normalizeExchangeId(inputs.exchangeId);
  return {
    exchangeId,
    marketType: normalizeMarketType(inputs.marketType),
    sandbox: cleanBoolean(inputs.sandbox),
    credentialProfile: normalizeProfile(inputs.credentialProfile, exchangeId),
    requiresPrivate,
  };
}

function marketFromExchange(exchange: CryptoExchange, symbol: string): Record<string, unknown> {
  return exchange.market?.(symbol) ?? exchange.markets?.[symbol] ?? {};
}

function referencePrice(ticker: Record<string, unknown>, side: CryptoOrderSide): number {
  const candidates = side === "buy"
    ? [ticker.ask, ticker.last, ticker.close, ticker.bid]
    : [ticker.bid, ticker.last, ticker.close, ticker.ask];
  for (const value of candidates) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  throw new Error("Ticker does not contain a usable reference price");
}

export function estimateOrderNotional(amount: number, price: number, contractSize = 1): number {
  const notional = amount * price * contractSize;
  if (!Number.isFinite(notional) || notional <= 0) throw new Error("Order notional is invalid");
  return notional;
}

function precisionNumber(value: string | number): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error("Exchange precision rounded the value to zero or an invalid number");
  return number;
}

function orderIntent(inputs: WorkflowData): {
  symbol: string;
  side: CryptoOrderSide;
  type: CryptoOrderType;
  amount: number;
  price?: number;
  leverage: number;
  reduceOnly: boolean;
  params: Record<string, unknown>;
} {
  const symbol = normalizeSymbol(inputs.symbol);
  const side = cleanText(inputs.side).toLowerCase();
  if (side !== "buy" && side !== "sell") throw new Error("side must be buy or sell");
  const type = cleanText(inputs.orderType, "market").toLowerCase();
  if (type !== "market" && type !== "limit") throw new Error("orderType must be market or limit");
  const amount = cleanNumber(inputs.amount);
  if (amount <= 0) throw new Error("amount must be greater than zero");
  const rawPrice = inputs.price == null || cleanText(inputs.price) === "" ? undefined : cleanNumber(inputs.price);
  if (type === "limit" && (!rawPrice || rawPrice <= 0)) throw new Error("price is required for limit orders");
  const leverage = Math.max(1, cleanNumber(inputs.leverage, 1));
  const params = parseSafeExchangeParams(inputs.paramsJson);
  const clientOrderId = cleanText(inputs.clientOrderId);
  const timeInForce = cleanText(inputs.timeInForce);
  if (clientOrderId) {
    if (!/^[A-Za-z0-9._:-]{1,64}$/.test(clientOrderId)) throw new Error("clientOrderId is invalid");
    params.clientOrderId = clientOrderId;
  }
  if (timeInForce) params.timeInForce = timeInForce;
  if (cleanBoolean(inputs.reduceOnly)) params.reduceOnly = true;
  return {
    symbol,
    side,
    type,
    amount,
    ...(rawPrice !== undefined ? { price: rawPrice } : {}),
    leverage,
    reduceOnly: cleanBoolean(inputs.reduceOnly),
    params,
  };
}

async function loadTicker(exchange: CryptoExchange, symbol: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const fetchTicker = requireMethod(exchange.fetchTicker?.bind(exchange), "fetchTicker");
  return fetchTicker(symbol, params);
}

function assertPrivateReadEnabled(env: NodeJS.ProcessEnv): void {
  if (!envBoolean(env, "CHERRYFLOW_CRYPTO_PRIVATE_READS", true)) {
    throw new Error("Private exchange reads are disabled by CHERRYFLOW_CRYPTO_PRIVATE_READS");
  }
}

function assertLiveGate(inputs: WorkflowData, session: ExchangeFactoryRequest, env: NodeJS.ProcessEnv, confirmationField: string): CryptoTableRow[] {
  const liveEnabled = envBoolean(env, "CHERRYFLOW_CRYPTO_LIVE_TRADING", false);
  const confirmed = cleanBoolean(inputs[confirmationField]);
  const approvalReference = cleanText(inputs.approvalReference);
  const requireSandbox = envBoolean(env, "CHERRYFLOW_CRYPTO_REQUIRE_SANDBOX", true);
  if (!liveEnabled) throw new Error("Live trading is disabled by CHERRYFLOW_CRYPTO_LIVE_TRADING");
  if (!confirmed) throw new Error(`${confirmationField} must be true`);
  if (approvalReference.length < 4) throw new Error("approvalReference is required for account-changing operations");
  if (requireSandbox && !session.sandbox) throw new Error("Sandbox mode is required by CHERRYFLOW_CRYPTO_REQUIRE_SANDBOX");
  return checks(
    ["live trading feature flag", liveEnabled, "CHERRYFLOW_CRYPTO_LIVE_TRADING=true"],
    ["explicit confirmation", confirmed, confirmationField],
    ["approval reference", approvalReference.length >= 4, approvalReference || "missing"],
    ["sandbox policy", !requireSandbox || session.sandbox, requireSandbox ? "sandbox required" : "production venue allowed"],
  );
}

export async function runCryptoExchangeCatalog(context: ModuleContext, env: NodeJS.ProcessEnv = process.env): Promise<CryptoModuleOutput> {
  const inputs = inputValues(context);
  const query = cleanText(inputs.query).toLowerCase();
  try {
    const module = catalogOverride ? undefined : await loadCcxtModule(env);
    const root = module ? ccxtRoot(module) : undefined;
    const exchanges = catalogOverride ?? module?.exchanges ?? (Array.isArray(root?.exchanges) ? root.exchanges as string[] : []);
    const allowed = csvSet(env.CHERRYFLOW_CRYPTO_ALLOWED_EXCHANGES?.toLowerCase());
    const rows = [...new Set(exchanges)]
      .filter((id) => !allowed || allowed.has(id.toLowerCase()))
      .filter((id) => !query || id.toLowerCase().includes(query))
      .sort()
      .slice(0, MAX_CATALOG_ROWS)
      .map((id) => ({ exchangeId: id, adapter: "ccxt", allowed: true }));
    const version = cleanText(module?.version ?? root?.version, catalogOverride ? "test" : "unknown");
    return output(
      "catalog-ready",
      `# Exchange Catalog\n\nพบ ${rows.length} exchange ผ่าน CCXT ${version}`,
      `Unified adapter พร้อมสำหรับ ${rows.length} exchange ตาม allowlist ปัจจุบัน`,
      rows,
      checks(["CCXT adapter", true, `version ${version}`]),
    );
  } catch (error) {
    const message = safeError(error);
    return output(
      "adapter-unavailable",
      `# CCXT adapter ยังไม่พร้อม\n\n${message}`,
      "ติดตั้ง CCXT ก่อนเชื่อม Exchange จริง",
      [{ adapter: "ccxt", installed: false, command: "pnpm --filter @cherryflow/api add ccxt" }],
      checks(["CCXT adapter", false, message]),
    );
  }
}

export async function runCryptoExchangeInspect(context: ModuleContext, env: NodeJS.ProcessEnv = process.env): Promise<CryptoModuleOutput> {
  const inputs = inputValues(context);
  const session = sessionFromInputs(inputs, false);
  return withExchange(session, env, async (exchange) => {
    const methods = ["fetchTicker", "fetchOHLCV", "fetchBalance", "fetchOpenOrders", "createOrder", "cancelOrder", "setLeverage"];
    const rows = methods.map((method) => ({ method, supported: capability(exchange, method) }));
    return output(
      "exchange-inspected",
      `# ${exchange.name ?? session.exchangeId}\n\nMarket type: ${session.marketType}\nSandbox: ${session.sandbox ? "yes" : "no"}`,
      `${session.exchangeId} โหลด markets แล้วและตรวจ capability ${rows.length} รายการ`,
      rows,
      checks(["exchange allowlist", true, session.exchangeId], ["sandbox mode", true, String(session.sandbox)]),
    );
  });
}

export async function runCryptoTicker(context: ModuleContext, env: NodeJS.ProcessEnv = process.env): Promise<CryptoModuleOutput> {
  const inputs = inputValues(context);
  const session = sessionFromInputs(inputs, false);
  const symbol = normalizeSymbol(inputs.symbol);
  assertSymbolAllowed(symbol, env);
  const params = parseSafeExchangeParams(inputs.paramsJson);
  return withExchange(session, env, async (exchange) => {
    const ticker = await loadTicker(exchange, symbol, params);
    const row: CryptoTableRow = {
      exchange: session.exchangeId,
      symbol: cleanText(ticker.symbol, symbol),
      timestamp: isoTime(ticker.timestamp ?? ticker.datetime),
      last: cell(ticker.last ?? ticker.close),
      bid: cell(ticker.bid),
      ask: cell(ticker.ask),
      high: cell(ticker.high),
      low: cell(ticker.low),
      baseVolume: cell(ticker.baseVolume),
      quoteVolume: cell(ticker.quoteVolume),
      sandbox: session.sandbox,
    };
    return output(
      "market-data",
      `# ${session.exchangeId} · ${symbol}\n\nLast: ${String(row.last)}\nBid / Ask: ${String(row.bid)} / ${String(row.ask)}`,
      `ดึง Ticker ${symbol} สำเร็จ`,
      [row],
      checks(["public market data", true, "no private credential required"], ["symbol allowlist", true, symbol]),
    );
  });
}

export async function runCryptoOhlcv(context: ModuleContext, env: NodeJS.ProcessEnv = process.env): Promise<CryptoModuleOutput> {
  const inputs = inputValues(context);
  const session = sessionFromInputs(inputs, false);
  const symbol = normalizeSymbol(inputs.symbol);
  assertSymbolAllowed(symbol, env);
  const timeframe = cleanText(inputs.timeframe, "1h");
  const limit = Math.min(500, Math.max(1, Math.floor(cleanNumber(inputs.limit, 100))));
  const sinceText = cleanText(inputs.since);
  const since = sinceText ? Date.parse(sinceText) : undefined;
  if (sinceText && !Number.isFinite(since)) throw new Error("since is not a valid date");
  const params = parseSafeExchangeParams(inputs.paramsJson);
  return withExchange(session, env, async (exchange) => {
    const fetchOHLCV = requireMethod(exchange.fetchOHLCV?.bind(exchange), "fetchOHLCV");
    const candles = await fetchOHLCV(symbol, timeframe, since, limit, params);
    const rows = candles.map((candle) => ({
      timestamp: isoTime(candle[0]),
      open: cell(candle[1]),
      high: cell(candle[2]),
      low: cell(candle[3]),
      close: cell(candle[4]),
      volume: cell(candle[5]),
    }));
    return output(
      "market-history",
      `# OHLCV ${session.exchangeId} · ${symbol}\n\nTimeframe: ${timeframe}\nCandles: ${rows.length}`,
      `ดึง OHLCV ${rows.length} แท่งสำเร็จ`,
      rows,
      checks(["public market data", true, timeframe], ["row limit", rows.length <= 500, String(rows.length)]),
    );
  });
}

export async function runCryptoBalance(context: ModuleContext, env: NodeJS.ProcessEnv = process.env): Promise<CryptoModuleOutput> {
  assertPrivateReadEnabled(env);
  const inputs = inputValues(context);
  const session = sessionFromInputs(inputs, true);
  const params = parseSafeExchangeParams(inputs.paramsJson);
  const includeZero = cleanBoolean(inputs.includeZeroBalances);
  return withExchange(session, env, async (exchange) => {
    const fetchBalance = requireMethod(exchange.fetchBalance?.bind(exchange), "fetchBalance");
    const balance = await fetchBalance(params);
    const total = balance.total && typeof balance.total === "object" ? balance.total as Record<string, unknown> : {};
    const free = balance.free && typeof balance.free === "object" ? balance.free as Record<string, unknown> : {};
    const used = balance.used && typeof balance.used === "object" ? balance.used as Record<string, unknown> : {};
    const currencies = [...new Set([...Object.keys(total), ...Object.keys(free), ...Object.keys(used)])].sort();
    const rows = currencies
      .map((currency) => ({
        currency,
        free: cell(free[currency]),
        used: cell(used[currency]),
        total: cell(total[currency]),
      }))
      .filter((row) => includeZero || [row.free, row.used, row.total].some((value) => Number(value) !== 0));
    return output(
      "account-balance",
      `# Balance · ${session.exchangeId}\n\nพบ ${rows.length} สินทรัพย์ที่แสดงผล`,
      `อ่านยอดคงเหลือจาก credential profile ${session.credentialProfile ?? session.exchangeId}`,
      rows,
      checks(["private reads enabled", true, "read-only operation"], ["credentials server-side", true, "workflow inputs contain no API secret"]),
    );
  });
}

export async function runCryptoOpenOrders(context: ModuleContext, env: NodeJS.ProcessEnv = process.env): Promise<CryptoModuleOutput> {
  assertPrivateReadEnabled(env);
  const inputs = inputValues(context);
  const session = sessionFromInputs(inputs, true);
  const symbolText = cleanText(inputs.symbol);
  const symbol = symbolText ? normalizeSymbol(symbolText) : undefined;
  if (symbol) assertSymbolAllowed(symbol, env);
  const limit = Math.min(500, Math.max(1, Math.floor(cleanNumber(inputs.limit, 100))));
  const params = parseSafeExchangeParams(inputs.paramsJson);
  return withExchange(session, env, async (exchange) => {
    const fetchOpenOrders = requireMethod(exchange.fetchOpenOrders?.bind(exchange), "fetchOpenOrders");
    const orders = await fetchOpenOrders(symbol, undefined, limit, params);
    const rows = orders.map((order) => ({
      id: cell(order.id),
      symbol: cell(order.symbol),
      type: cell(order.type),
      side: cell(order.side),
      price: cell(order.price),
      amount: cell(order.amount),
      filled: cell(order.filled),
      remaining: cell(order.remaining),
      status: cell(order.status),
      timestamp: isoTime(order.timestamp ?? order.datetime),
    }));
    return output(
      "open-orders",
      `# Open Orders · ${session.exchangeId}\n\n${rows.length} orders`,
      `อ่านรายการคำสั่งซื้อขายที่เปิดอยู่${symbol ? ` สำหรับ ${symbol}` : ""}`,
      rows,
      checks(["private reads enabled", true, "no order mutation"], ["result limit", rows.length <= limit, String(limit)]),
    );
  });
}

export async function runCryptoPaperOrder(context: ModuleContext, env: NodeJS.ProcessEnv = process.env): Promise<CryptoModuleOutput> {
  const inputs = inputValues(context);
  const session = sessionFromInputs(inputs, false);
  const intent = orderIntent(inputs);
  assertSymbolAllowed(intent.symbol, env);
  return withExchange(session, env, async (exchange) => {
    const ticker = await loadTicker(exchange, intent.symbol, {});
    const market = marketFromExchange(exchange, intent.symbol);
    const contractSize = Math.max(0.00000001, Number(market.contractSize ?? 1));
    const price = intent.type === "limit" && intent.price ? intent.price : referencePrice(ticker, intent.side);
    const amount = exchange.amountToPrecision ? precisionNumber(exchange.amountToPrecision(intent.symbol, intent.amount)) : intent.amount;
    const precisePrice = exchange.priceToPrecision ? precisionNumber(exchange.priceToPrecision(intent.symbol, price)) : price;
    const notional = estimateOrderNotional(amount, precisePrice, contractSize);
    const feeBps = Math.max(0, cleanNumber(inputs.feeBps, 10));
    const estimatedFee = notional * feeBps / 10_000;
    const row: CryptoTableRow = {
      exchange: session.exchangeId,
      mode: "paper",
      marketType: session.marketType,
      symbol: intent.symbol,
      side: intent.side,
      orderType: intent.type,
      amount,
      referencePrice: precisePrice,
      contractSize,
      estimatedQuoteNotional: Number(notional.toFixed(8)),
      estimatedFee: Number(estimatedFee.toFixed(8)),
      leverage: intent.leverage,
      reduceOnly: intent.reduceOnly,
    };
    return output(
      "paper-order",
      `# Paper Trade\n\n${intent.side.toUpperCase()} ${amount} ${intent.symbol} @ ${precisePrice}\nEstimated quote notional: ${notional.toFixed(8)}`,
      "จำลองคำสั่งซื้อขายเท่านั้น ไม่มีคำสั่งถูกส่งไป Exchange",
      [row],
      checks(["paper mode", true, "createOrder was not called"], ["symbol allowlist", true, intent.symbol], ["positive notional", notional > 0, String(notional)]),
    );
  });
}

export async function runCryptoCreateOrder(context: ModuleContext, env: NodeJS.ProcessEnv = process.env): Promise<CryptoModuleOutput> {
  const inputs = inputValues(context);
  const session = sessionFromInputs(inputs, true);
  const gateChecks = assertLiveGate(inputs, session, env, "confirmLiveTrade");
  const intent = orderIntent(inputs);
  assertSymbolAllowed(intent.symbol, env);
  return withExchange(session, env, async (exchange) => {
    const createOrder = requireMethod(exchange.createOrder?.bind(exchange), "createOrder");
    const ticker = await loadTicker(exchange, intent.symbol, {});
    const market = marketFromExchange(exchange, intent.symbol);
    if (market.active === false) throw new Error(`Market is inactive: ${intent.symbol}`);
    const contractSize = Math.max(0.00000001, Number(market.contractSize ?? 1));
    const reference = intent.type === "limit" && intent.price ? intent.price : referencePrice(ticker, intent.side);
    const amount = exchange.amountToPrecision ? precisionNumber(exchange.amountToPrecision(intent.symbol, intent.amount)) : intent.amount;
    const price = intent.type === "limit"
      ? (exchange.priceToPrecision ? precisionNumber(exchange.priceToPrecision(intent.symbol, reference)) : reference)
      : undefined;
    const estimatedNotional = estimateOrderNotional(amount, reference, contractSize);
    const maxNotional = envNumber(env, "CHERRYFLOW_CRYPTO_MAX_ORDER_NOTIONAL", 1_000);
    if (estimatedNotional > maxNotional) {
      throw new Error(`Estimated quote notional ${estimatedNotional} exceeds CHERRYFLOW_CRYPTO_MAX_ORDER_NOTIONAL ${maxNotional}`);
    }

    const maxLeverage = envNumber(env, "CHERRYFLOW_CRYPTO_MAX_LEVERAGE", 3);
    if (intent.leverage > 1) {
      if (!envBoolean(env, "CHERRYFLOW_CRYPTO_ALLOW_LEVERAGE", false)) throw new Error("Leverage is disabled by CHERRYFLOW_CRYPTO_ALLOW_LEVERAGE");
      if (intent.leverage > maxLeverage) throw new Error(`Leverage ${intent.leverage} exceeds maximum ${maxLeverage}`);
      const setLeverage = requireMethod(exchange.setLeverage?.bind(exchange), "setLeverage");
      await setLeverage(intent.leverage, intent.symbol, {});
    }

    const order = await createOrder(intent.symbol, intent.type, intent.side, amount, price, intent.params);
    const row: CryptoTableRow = {
      id: cell(order.id),
      clientOrderId: cell(order.clientOrderId),
      exchange: session.exchangeId,
      sandbox: session.sandbox,
      symbol: cell(order.symbol ?? intent.symbol),
      type: cell(order.type ?? intent.type),
      side: cell(order.side ?? intent.side),
      amount: cell(order.amount ?? amount),
      price: cell(order.price ?? price ?? reference),
      filled: cell(order.filled),
      remaining: cell(order.remaining),
      status: cell(order.status),
      timestamp: isoTime(order.timestamp ?? order.datetime),
      estimatedQuoteNotional: Number(estimatedNotional.toFixed(8)),
    };
    return output(
      session.sandbox ? "sandbox-order-created" : "live-order-created",
      `# Order Submitted\n\nExchange: ${session.exchangeId}\nOrder ID: ${String(row.id)}\n${intent.side.toUpperCase()} ${amount} ${intent.symbol}`,
      session.sandbox ? "ส่งคำสั่งไป Testnet/Sandbox แล้ว" : "ส่งคำสั่งเงินจริงไป Exchange แล้ว",
      [row],
      [
        ...gateChecks,
        ...checks(
          ["symbol allowlist", true, intent.symbol],
          ["notional limit", estimatedNotional <= maxNotional, `${estimatedNotional} / ${maxNotional}`],
          ["leverage limit", intent.leverage <= maxLeverage, `${intent.leverage} / ${maxLeverage}`],
        ),
      ],
    );
  });
}

export async function runCryptoCancelOrder(context: ModuleContext, env: NodeJS.ProcessEnv = process.env): Promise<CryptoModuleOutput> {
  const inputs = inputValues(context);
  const session = sessionFromInputs(inputs, true);
  const gateChecks = assertLiveGate(inputs, session, env, "confirmCancel");
  const orderId = cleanText(inputs.orderId);
  if (!orderId || orderId.length > 200) throw new Error("orderId is required");
  const symbolText = cleanText(inputs.symbol);
  const symbol = symbolText ? normalizeSymbol(symbolText) : undefined;
  if (symbol) assertSymbolAllowed(symbol, env);
  const params = parseSafeExchangeParams(inputs.paramsJson);
  return withExchange(session, env, async (exchange) => {
    const cancelOrder = requireMethod(exchange.cancelOrder?.bind(exchange), "cancelOrder");
    const order = await cancelOrder(orderId, symbol, params);
    const row: CryptoTableRow = {
      id: cell(order.id ?? orderId),
      exchange: session.exchangeId,
      sandbox: session.sandbox,
      symbol: cell(order.symbol ?? symbol),
      status: cell(order.status ?? "cancel-requested"),
      timestamp: isoTime(order.timestamp ?? order.datetime),
    };
    return output(
      session.sandbox ? "sandbox-order-cancelled" : "order-cancelled",
      `# Cancel Order\n\nExchange: ${session.exchangeId}\nOrder ID: ${orderId}`,
      "ส่งคำขอยกเลิกคำสั่งซื้อขายแล้ว",
      [row],
      gateChecks,
    );
  });
}

function moduleDefinition(type: string, label: string, description: string, run: ModuleDefinition["run"]): ModuleDefinition {
  return { type, label, description, run };
}

export function createCryptoExchangeCatalogModuleDefinition(): ModuleDefinition {
  return moduleDefinition("crypto.exchange.catalog", "Crypto Exchange Catalog", "List CCXT-supported exchanges visible to CherryFlow's allowlist.", runCryptoExchangeCatalog);
}

export function createCryptoExchangeInspectModuleDefinition(): ModuleDefinition {
  return moduleDefinition("crypto.exchange.inspect", "Crypto Exchange Capability Inspector", "Load an exchange and report supported unified market/account/order methods.", runCryptoExchangeInspect);
}

export function createCryptoTickerModuleDefinition(): ModuleDefinition {
  return moduleDefinition("crypto.market.ticker", "Crypto Market Ticker", "Fetch a unified ticker from a CCXT-supported exchange.", runCryptoTicker);
}

export function createCryptoOhlcvModuleDefinition(): ModuleDefinition {
  return moduleDefinition("crypto.market.ohlcv", "Crypto OHLCV History", "Fetch normalized candles with timeframe and row limits.", runCryptoOhlcv);
}

export function createCryptoBalanceModuleDefinition(): ModuleDefinition {
  return moduleDefinition("crypto.account.balance", "Crypto Account Balance", "Read balances using server-side credential profiles without exposing secrets to workflow inputs.", runCryptoBalance);
}

export function createCryptoOpenOrdersModuleDefinition(): ModuleDefinition {
  return moduleDefinition("crypto.order.open", "Crypto Open Orders", "Read open orders from a private exchange API without mutating the account.", runCryptoOpenOrders);
}

export function createCryptoPaperOrderModuleDefinition(): ModuleDefinition {
  return moduleDefinition("crypto.order.paper", "Crypto Paper Order", "Simulate order precision, reference price, quote notional, and fees without calling createOrder.", runCryptoPaperOrder);
}

export function createCryptoCreateOrderModuleDefinition(): ModuleDefinition {
  return moduleDefinition("crypto.order.create", "Crypto Create Order", "Create a sandbox or live order only after feature flags, approval reference, confirmation, allowlists, and risk limits pass.", runCryptoCreateOrder);
}

export function createCryptoCancelOrderModuleDefinition(): ModuleDefinition {
  return moduleDefinition("crypto.order.cancel", "Crypto Cancel Order", "Cancel an order only after account-changing operation gates pass.", runCryptoCancelOrder);
}
