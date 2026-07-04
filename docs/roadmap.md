# CherryFlow Roadmap

This roadmap breaks the remaining work after CherryFlow v0.3 into four delivery phases. Each phase has a clear goal, scope, and completion criteria.

## Phase 1 — Production Core

### Goal

Move CherryFlow from a local MVP to a durable production-ready runtime where data survives restarts and workflows can execute reliably at scale.

### Scope

- Add PostgreSQL schema and migrations
- Move workflows, versions, published apps, and runs from JSON storage to PostgreSQL
- Add Redis/BullMQ workers
- Add retry, timeout, cancel, and resume support
- Add per-node run logs and execution history
- Add MinIO/S3 storage for workflow input and output files
- Add file retention and cleanup jobs
- Add health checks for API, workers, PostgreSQL, Redis, and storage
- Add a production Docker Compose deployment

### Completion criteria

- Restarting API or workers does not lose workflow data or run history
- Multiple workflows can execute concurrently
- Failed nodes expose clear error logs and retry state
- Input and output files are stored outside the API process

---

## Phase 2 — Visual Workflow and Core Modules

### Goal

Allow users to build workflows without editing source code.

### Scope

- Visual workflow canvas with draggable nodes and connections
- Node configuration panel
- Graph validation before save and run
- Duplicate, import, and export workflows
- Workflow templates
- Trigger types:
  - Manual
  - Webhook
  - Schedule/Cron
  - Published form submission
- Core modules:
  - HTTP Request
  - Webhook Response
  - Condition and Switch
  - Transform JSON
  - Excel/CSV Reader
  - PDF Text Extract
  - LLM Prompt
  - AI Agent/OpenClaw (executable module available; visual configuration remains)
  - PostgreSQL/MySQL Query
  - Generate PDF/DOCX
  - Email
  - LINE Messaging
  - Human Approval
- Test a single node before running the complete flow
- Run from a selected node

### Completion criteria

A user can create and execute this workflow entirely from the UI:

```text
Upload Excel
→ Extract Data
→ AI Analyze
→ Human Approval
→ Generate PDF
→ Send LINE
```

---

## Phase 3 — SaaS, Security, and Website Builder Pro

### Goal

Support multiple organizations securely and make published workflow websites suitable for customers.

### Scope

#### SaaS foundation

- Login and session management
- Workspaces and organizations
- User invitations
- Roles: Owner, Admin, Builder, Operator, Viewer
- Tenant isolation
- API keys
- Usage metering
- Quotas and rate limits

#### Security

- Credential vault
- Encryption for secrets
- CSRF protection
- Restrictive CORS
- File malware scanning
- Audit logs
- Agent tool allowlists
- OpenClaw sandbox policy
- Secret masking in logs and browser payloads

#### Website Builder Pro

- Theme editor
- Logo, typography, and branding controls
- Section reordering
- Responsive device preview
- Access modes: Public, Login Required, Organization Only
- Custom domains
- SEO metadata
- Draft, Preview, and Production environments
- Form submission history
- Basic analytics

### Completion criteria

Two organizations can use the same CherryFlow deployment without seeing each other’s workflows, credentials, files, websites, or run history.

---

## Phase 4 — Enterprise Scale and Ecosystem

### Goal

Turn CherryFlow into a highly available enterprise platform with an extensible module and template ecosystem.

### Scope

- Worker autoscaling
- Separate worker pools for CPU, GPU, document, and agent workloads
- Priority queues
- High availability
- PostgreSQL replication and backups
- Redis high availability
- Distributed MinIO
- Metrics, tracing, and centralized logs
- Grafana dashboards
- Workflow failure alerting
- SLA/SLO dashboards
- Dev → Staging → Production promotion
- Approval gates before publishing
- LDAP, OIDC, and SAML SSO
- White-label support
- Billing and subscriptions
- Module SDK
- Private module registry
- Template marketplace
- Community modules
- Workflow marketplace
- Multi-region deployment and disaster recovery
- Enterprise audit export
- Policy engine and compliance controls

### Completion criteria

CherryFlow supports multiple enterprise tenants, high availability, disaster recovery, external module developers, and commercial workflow/template distribution.

---

## Recommended order

```text
Phase 1: Make the runtime durable and reliable
Phase 2: Make workflow creation self-service
Phase 3: Make the product secure and sellable as SaaS
Phase 4: Make the platform scalable and extensible
```

## Current status

- CherryFlow v0.3 workflow graph engine and generated workflow websites: merged in PR #4
- Local-first Qwen product positioning and architecture documentation: merged in PR #5
- Local deterministic, OpenAI-compatible, and OpenClaw provider modes: available
- Explicit OpenClaw bridge client: available
- Executable `agent.openclaw` workflow module with approval-reference guard: available
- Phase 1 durable persistence and distributed workers: not started
- Phase 2 visual workflow canvas and remaining core modules: not started
- Phase 3 SaaS and tenant security: not started
- Phase 4 enterprise scale and ecosystem: not started
