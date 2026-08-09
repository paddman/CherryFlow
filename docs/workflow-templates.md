# Workflow Template Library

CherryFlow includes 44 runnable workflow templates. Each template has a real Workflow Contract, executable graph, form inputs, output bindings, and metadata for the Template Gallery.

## Product surfaces

- `/templates` browses and filters all templates.
- `/run/{workflowId}` runs a template immediately.
- `/builder?workflow={workflowId}` uses the selected workflow as the contract for an AI-generated application.
- `GET /api/templates` returns safe public template metadata.
- `GET /api/workflows/{workflowId}` returns the workflow contract after authentication.

## Categories

| Category | Examples |
|---|---|
| Documents and reports | AI Report Generator, Meeting Minutes, Executive Brief, Proposal, SOP, Contract Review, Policy Gap |
| Sales and marketing | Lead Qualification, Proposal Email, Campaign Plan, Content Calendar, Product Description, Sales Call Follow-up |
| Human resources | Job Description, Resume Screening, Interview Guide, Onboarding, Performance Review |
| Customer service | Complaint Triage, Service Recovery, FAQ and Knowledge Article |
| IT and security | Incident Triage, RCA, Change Risk, Cyber Alert Summary, Vulnerability Remediation |
| Finance, data, and projects | Budget Variance, Procurement Comparison, Project Status, Risk Register, Data Quality Audit |
| Integrations and ChatOps | Telegram Bot, Discord Webhook, LINE Official Account, Multi-channel Dispatch |
| Crypto trading | Exchange Catalog, Capability Inspector, Market Snapshot, OHLCV, Portfolio, Open Orders, Paper Trade, Live/Sandbox Order, Cancel Order |

## Reusable `ai.task` module

Most business templates use the reusable `ai.task` module:

```text
core.input → ai.task → core.output
```

The template config supplies task name, professional role, instructions, input labels, and an optional source-file field. When a compatible model is configured, the module requests structured result, summary, checklist, and next steps. Invalid or unavailable model output falls back to a deterministic, reviewable draft.

## Notification modules

```text
notify.telegram
notify.discord
notify.line
notify.dispatch
```

Credentials remain in server environment variables. Dry Run is enabled by default and external delivery also requires `confirmSend=true`. See [`notification-connectors.md`](notification-connectors.md).

## Crypto exchange modules

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

Exchange credentials remain server-side. Paper trading never submits an order. Live and cancel operations require explicit server flags, confirmation, approval reference, allowlists, sandbox policy, notional limits, and leverage limits. See [`crypto-trading.md`](crypto-trading.md).

## Safety model

Templates produce drafts and decision support. They do not approve contracts, hire candidates, authorize infrastructure changes, or choose vendors. Human review remains required before external publication or operational action.

Notification templates are external side effects. Test with Dry Run, verify the destination, then explicitly confirm the send.

Crypto templates separate public data, private reads, paper simulation, and account-changing operations. API keys must remain server-side and should not have withdrawal permission. An AI-generated signal may propose an order intent, but it must not approve itself, change the server risk policy, or select arbitrary private exchange methods.
