# Telegram, Discord, and LINE notification connectors

CherryFlow provides outbound notification modules for workflow results, alerts, approvals, and ChatOps messages.

## Scope

Implemented:

- Telegram Bot API outbound text messages
- Discord incoming-webhook outbound text messages
- LINE Messaging API push text messages
- Multi-channel dispatch with a separate result for every selected provider

Not implemented in this milestone:

- inbound bot commands
- Telegram, Discord, or LINE webhook receivers
- interactive buttons, Flex Messages, embeds, files, or media
- automatic retries for Telegram or Discord
- delivery-read receipts

The modules are intended as the final step of a validated workflow. Inbound bots and webhook triggers should be implemented as a separate authenticated ingress layer rather than mixed into outbound delivery code.

## Module types

| Module | Purpose |
|---|---|
| `notify.telegram` | Send through Telegram Bot API `sendMessage` |
| `notify.discord` | Execute a Discord incoming webhook |
| `notify.line` | Push through LINE Messaging API |
| `notify.dispatch` | Send one message to selected Telegram, Discord, and LINE destinations |

Each module returns the standard template outputs:

- `result`
- `summary`
- `checklist`
- `nextSteps`
- `aiStatus`

## Ready-to-run templates

Open `/templates` and select **Integrations และ ChatOps**:

- Telegram Bot Notification
- Discord Webhook Notification
- LINE Official Account Push
- Telegram + Discord + LINE Dispatch

The runner supports Dry Run and explicit confirmation before an external request is sent.

## Safe default

`.env.example` enables:

```env
CHERRYFLOW_NOTIFICATION_DRY_RUN=true
```

In this mode CherryFlow validates the message, destination, provider limits, and chunk count without calling Telegram, Discord, or LINE.

To enable real delivery:

```env
CHERRYFLOW_NOTIFICATION_DRY_RUN=false
```

The workflow input `confirmSend` must also be true. A disabled Dry Run alone is not enough to send an external message.

## Telegram

Configure the Bot API token and an optional default chat ID:

```env
TELEGRAM_BOT_TOKEN=123456789:replace-with-bot-token
TELEGRAM_CHAT_ID=-1001234567890
TELEGRAM_API_BASE_URL=https://api.telegram.org
```

The workflow may supply `telegramChatId`; otherwise `TELEGRAM_CHAT_ID` is used. Messages are plain text, link previews are disabled, and `silent` maps to Telegram's notification-suppression option.

Long messages are split safely into chunks. CherryFlow refuses messages that exceed the configured per-run chunk cap instead of silently discarding text.

## Discord

Create an incoming webhook for the intended channel and store the complete URL only on the API server:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN
DISCORD_USERNAME=CherryFlow Ops
```

The webhook URL is a credential. Do not place it in Workflow Contract inputs, Canvas configuration, browser storage, screenshots, or committed files.

CherryFlow sends `allowed_mentions.parse=[]`. Text such as `@everyone` remains visible but does not create an allowed mention through the webhook payload.

## LINE

CherryFlow uses the LINE Messaging API, not LINE Notify.

Configure a Messaging API channel access token and an optional default recipient:

```env
LINE_CHANNEL_ACCESS_TOKEN=replace-with-channel-access-token
LINE_TO=Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LINE_API_BASE_URL=https://api.line.me
```

`LINE_TO` may be a user, group, or room ID supported by the Messaging API channel. The workflow may supply `lineTo`; otherwise the server default is used.

Each push request includes an `X-Line-Retry-Key`, but CherryFlow does not automatically loop and resubmit failed provider requests. Operators should inspect the run result before retrying to reduce duplicate-message risk.

## Multi-channel dispatch

The `notify.dispatch` module reads these boolean inputs:

- `sendTelegram`
- `sendDiscord`
- `sendLine`

It attempts selected channels sequentially and returns a row for every provider. If one provider fails while another succeeds, the run returns `notification-partial` so operators can see the split result. If every selected channel fails, the workflow fails.

## Secrets and endpoint policy

Provider credentials are read from environment variables inside the API process. Output masks destination identifiers and never returns tokens or webhook URLs.

By default, CherryFlow accepts official provider endpoints only. Trusted internal gateways or local test servers require:

```env
CHERRYFLOW_ALLOW_CUSTOM_CONNECTOR_ENDPOINTS=true
```

Custom endpoints must use HTTPS. Loopback HTTP is allowed for local testing. Do not enable this option merely to make an invalid public URL stop complaining. Computers are literal and criminals are patient.

## Timeouts

```env
CHERRYFLOW_NOTIFICATION_TIMEOUT_MS=15000
```

The accepted range is 1,000 to 120,000 milliseconds.

## Message limits

CherryFlow uses conservative provider limits:

| Provider | Chunk size | Maximum chunks per run |
|---|---:|---:|
| Telegram | 4,096 characters | 10 |
| Discord | 2,000 characters | 10 |
| LINE | 5,000 characters | 5 |

The current modules send plain text only.

## Example graph

```text
core.input
    ↓
notify.dispatch
    ↓
core.output
```

A composed workflow can also route the output of an AI task into a connector:

```text
core.input → ai.task → human approval → notify.telegram → core.output
```

The connector supports `sourceNode`, `titleField`, `messageField`, and `severityField` configuration for this pattern. Human approval remains a future core module; until then, use the template confirmation gate or an external approval system.

## Validation

Run:

```bash
pnpm check
```

Tests cover:

- Dry Run without network access
- Telegram request shape and token redaction
- Discord mention suppression and webhook redaction
- LINE bearer token, push endpoint, and retry key
- explicit confirmation before real delivery
- partial multi-channel results
- blocking untrusted custom endpoints
- graph validation for all four templates
