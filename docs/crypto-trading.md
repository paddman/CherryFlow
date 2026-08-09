# Crypto Trading Framework

CherryFlow provides a CCXT-based exchange adapter and guarded workflow modules for market data, account reads, paper trading, sandbox orders, live orders, and cancellation.

The goal is one normalized workflow boundary across many exchanges, not the fiction that every exchange implements every method or parameter identically. Use the capability inspector before building a strategy for a venue.

## Install the optional adapter

The default CherryFlow checkout does not force-install CCXT. This keeps the normal document and ChatOps build lightweight.

Install the adapter when crypto workflows are required:

```bash
pnpm crypto:install
```

Equivalent command:

```bash
pnpm --filter @cherryflow/api add ccxt@^4.5.67
```

The runtime loads `ccxt` dynamically. Without it, the catalog workflow returns an installation diagnostic instead of breaking the entire API.

## Included modules

```text
crypto.exchange.catalog
crypto.exchange.inspect
crypto.market.ticker
crypto.market.ohlcv
crypto.account.balance
crypto.order.open
crypto.order.paper
crypto.order.create
crypto.order.cancel
```

## Included templates

- Crypto Exchange Catalog
- Exchange Capability Inspector
- Crypto Market Snapshot
- Crypto OHLCV History
- Crypto Portfolio Balance
- Crypto Open Orders
- Crypto Paper Trade
- Crypto Live / Sandbox Order
- Crypto Cancel Order

Open them from `/templates` under `Crypto Trading`, or run a template directly at `/run/{workflowId}`.

## Supported markets

The adapter can request these CCXT market modes:

- `spot`
- `margin`
- `swap`
- `future`
- `option`

Actual support is exchange-specific. `crypto.exchange.inspect` reports the unified methods declared by the selected adapter. A method being present does not guarantee that every symbol, account type, order type, or exchange-specific parameter is supported.

## Safe defaults

```env
CHERRYFLOW_CRYPTO_LIVE_TRADING=false
CHERRYFLOW_CRYPTO_REQUIRE_SANDBOX=true
CHERRYFLOW_CRYPTO_PRIVATE_READS=true
CHERRYFLOW_CRYPTO_ALLOW_LEVERAGE=false
CHERRYFLOW_CRYPTO_MAX_ORDER_NOTIONAL=1000
CHERRYFLOW_CRYPTO_MAX_LEVERAGE=3
CHERRYFLOW_CRYPTO_TIMEOUT_MS=15000
```

Recommended allowlists:

```env
CHERRYFLOW_CRYPTO_ALLOWED_EXCHANGES=binance,okx,bybit,bitget,kraken,coinbase
CHERRYFLOW_CRYPTO_ALLOWED_SYMBOLS=BTC/USDT,ETH/USDT,BTC/USD
```

If an allowlist variable is omitted, the corresponding catalog remains unrestricted. Controlled production deployments should set both.

## Credential profiles

API credentials must stay on the API server. Workflow forms accept only a profile name, never an API key or secret.

Exchange-level convention:

```env
CHERRYFLOW_CRYPTO_BINANCE_API_KEY=replace-me
CHERRYFLOW_CRYPTO_BINANCE_SECRET=replace-me
```

Named profile convention:

```env
CHERRYFLOW_CRYPTO_PROFILE_TREASURY_API_KEY=replace-me
CHERRYFLOW_CRYPTO_PROFILE_TREASURY_SECRET=replace-me
CHERRYFLOW_CRYPTO_PROFILE_TREASURY_PASSWORD=optional-passphrase
CHERRYFLOW_CRYPTO_PROFILE_TREASURY_UID=optional-uid
```

For exchanges or decentralized adapters that require wallet credentials, named profiles may use:

```env
CHERRYFLOW_CRYPTO_PROFILE_DEX_WALLET_ADDRESS=0x...
CHERRYFLOW_CRYPTO_PROFILE_DEX_PRIVATE_KEY=replace-me
```

Private keys remain server-side. Do not commit them to the repository or pass them through workflow input JSON.

## Paper trading

`crypto.order.paper`:

- loads the exchange market catalog
- fetches a reference ticker
- applies amount and price precision where available
- reads contract size when available
- estimates quote notional
- estimates fees from basis points
- never calls `createOrder`

Use this mode to validate symbol formatting, precision, contract size, and notional before enabling sandbox execution.

## Live and sandbox order gate

`crypto.order.create` requires all of the following:

1. `CHERRYFLOW_CRYPTO_LIVE_TRADING=true`
2. `confirmLiveTrade=true` in the workflow input
3. a non-empty `approvalReference`
4. the exchange and symbol to pass their allowlists
5. estimated quote notional within `CHERRYFLOW_CRYPTO_MAX_ORDER_NOTIONAL`
6. sandbox mode when `CHERRYFLOW_CRYPTO_REQUIRE_SANDBOX=true`
7. leverage disabled or within the configured leverage policy
8. server-side private credentials for the selected profile

A recommended first test configuration is:

```env
CHERRYFLOW_CRYPTO_LIVE_TRADING=true
CHERRYFLOW_CRYPTO_REQUIRE_SANDBOX=true
CHERRYFLOW_CRYPTO_MAX_ORDER_NOTIONAL=50
CHERRYFLOW_CRYPTO_ALLOWED_EXCHANGES=binance
CHERRYFLOW_CRYPTO_ALLOWED_SYMBOLS=BTC/USDT
```

The word `LIVE_TRADING` means account-changing API calls are enabled. With sandbox required, those calls still target the exchange's test environment when the adapter supports it.

## Leverage

Leverage is separately disabled by default:

```env
CHERRYFLOW_CRYPTO_ALLOW_LEVERAGE=false
CHERRYFLOW_CRYPTO_MAX_LEVERAGE=3
```

An order requesting leverage above `1` is rejected unless leverage is enabled. The module then calls the unified `setLeverage` method before creating the order. Exchanges that do not support the method are rejected instead of silently ignoring the request.

## Exchange-specific parameters

Templates accept optional `paramsJson` for venue-specific settings such as:

```json
{
  "tdMode": "cross",
  "positionSide": "long"
}
```

The parser rejects nested keys that look like secrets or withdrawal operations, including API keys, tokens, private keys, seeds, mnemonics, and withdrawal fields.

CherryFlow does not expose arbitrary raw private REST calls. Supporting every exchange does not justify providing a generic "send any authenticated request" box, which would merely turn the workflow canvas into a polished credential exfiltration device.

## Deliberately excluded

This milestone does not implement:

- withdrawals
- internal transfers
- wallet signing in the browser
- arbitrary authenticated REST endpoints
- autonomous strategies that place unreviewed live orders
- claims of profitability
- tax, accounting, or regulatory compliance automation
- WebSocket order-book or private-account streams

Real-time streaming, strategy scheduling, backtesting, portfolio accounting, audit trails, dead-man switches, and reconciliation should be separate milestones with their own persistence and failure controls.

## Operational recommendations

- Create exchange API keys without withdrawal permission.
- Restrict keys by IP when the exchange supports it.
- Use a dedicated sub-account with a small balance for initial tests.
- Keep sandbox required until paper and sandbox runs reconcile with expected fills and fees.
- Set strict exchange, symbol, notional, and leverage allowlists.
- Persist order intents, approvals, exchange responses, and reconciliation results before commercial use.
- Treat provider timeouts as unknown state and reconcile by client order ID before retrying.
