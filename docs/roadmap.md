# CherryFlow Roadmap

This roadmap reflects the code currently in `main`. Earlier versions described PostgreSQL, Redis, MinIO/S3, authentication, pgvector memory, model registry, and the visual Canvas as future work even though those foundations had already landed. This revision aligns delivery status and future milestones with the implementation.

## Delivered foundations

### Workflow and application runtime

- Workflow contracts and DAG execution
- Node and edge validation
- Duplicate-edge, missing-node, invalid-output, and cycle rejection
- Per-node execution events and final outputs
- Safe UI Schema generation, normalization, and validation
- Preview, version, publish, slug routing, and rollback
- Published workflow applications
- Local deterministic planner
- OpenAI-compatible model provider
- Explicit OpenClaw bridge adapter
- CherryAgent tool modules

### Visual creation tools

- Drag-and-drop Workflow Canvas
- Node configuration panel
- Graph save, validation, and execution
- Flow JSON import and export
- Business Process Builder with configurable swimlanes
- Model Registry interface
- Operational Control Center for runtime and inventory visibility

### Data and infrastructure

- Local JSON persistence for zero-configuration development
- PostgreSQL persistence
- Ordered SQL migrations with status and checksum checks
- Redis-backed workflow run queue
- MinIO/S3 file storage
- PostgreSQL pgvector AI memory
- Local and OpenAI-compatible embedding providers
- Model endpoint sync and worker-pool metadata
- Development Docker Compose stack for PostgreSQL/pgvector, Redis, and MinIO

### Security baseline

- Session authentication
- PBKDF2 password hashing
- Hashed session tokens
- Roles: `admin`, `editor`, and `viewer`
- Management API authorization
- HTTP-only SameSite cookies
- Restrictive single-origin CORS configuration
- Safe component and binding allowlists
- Server-side provider credentials
- Published slug sanitization
- Browser security response headers

### Document workflow

- Excel, CSV, PDF, and text extraction
- Structured report composition
- PDF, DOCX, PPTX, and HTML rendering
- Optional Qwen + ReportLab PDF skill
- Inline or object-storage file output

---

## Current milestone: Operational visibility and hardening

### Goal

Turn existing foundations into one coherent platform that operators can inspect, configure, and troubleshoot without reading source code or opening a pile of terminals.

### Delivered in this milestone

- Authenticated `GET /api/overview`
- Control Center at `/dashboard`
- Runtime mode summary for AI, embeddings, state store, queue, files, and memory
- Workflow, module, Canvas, version, model, worker-pool, and RBAC totals
- Safe recent-version metadata without prompts, schemas, credentials, or workflow data
- Homepage navigation to operational tools
- Root `.env` loading for API and web workspace scripts
- Safe zero-configuration defaults in `.env.example`
- CI lockfile enforcement, concurrency cancellation, and least-privilege workflow permissions
- Updated README and roadmap aligned with the codebase

### Remaining hardening

- Active readiness probes for PostgreSQL, Redis, S3, model endpoints, and agent bridges
- Structured application logs with correlation IDs
- Metrics endpoint and Prometheus instrumentation
- Workflow latency, throughput, failure-rate, and queue-depth dashboards
- Audit trail for login, user changes, workflow edits, runs, publication, and rollback
- Secret masking across logs and browser payloads
- Browser end-to-end coverage for Dashboard, Builder, Canvas, Models, and published apps

### Completion criteria

- Operators can distinguish configured mode from active dependency health
- Every workflow run can be traced across API, queue, nodes, files, and model calls
- Critical failures produce actionable alerts with enough context for operators to resolve them efficiently

---

## Milestone 2: Reliable execution controls

### Goal

Make long-running and failure-prone workflows safe to operate.

### Scope

- Per-node timeout configuration
- Retry policy with exponential backoff and maximum attempts
- Cancel queued or running workflows
- Resume from a safe checkpoint
- Dead-letter queue for exhausted runs
- Idempotency keys for API and webhook triggers
- Run priority and concurrency limits
- Separate worker process from the API service
- Worker heartbeat and lease recovery
- Scheduled and cron triggers
- Webhook trigger management
- Manual approval nodes with durable waiting state
- Run from selected node and single-node testing

### Completion criteria

- Restarting an API or worker does not silently lose an active run
- Failed nodes show attempt history and can be retried safely
- Operators can cancel, resume, and inspect queued work
- Duplicate webhook delivery does not duplicate business effects

---

## Milestone 3: Workflow module expansion

### Goal

Allow real business automations to be built entirely from the UI.

### Core modules

- HTTP Request and Webhook Response
- Condition, Switch, Merge, Delay, and Loop controls
- JSON transform and schema validation
- PostgreSQL and MySQL query modules
- CSV/Excel read and write
- PDF extract and OCR
- LLM prompt and structured extraction
- Embedding and memory search
- Email
- LINE Messaging
- Generic notification webhook
- Human Approval
- Generate PDF, DOCX, PPTX, and HTML
- Object-storage read and write
- Dataset preparation and inference calls

### Builder improvements

- Workflow templates
- Searchable module categories
- Credential references instead of raw secrets
- Port and schema compatibility checks
- Node-level test panel
- Execution preview and sample data
- Undo/redo and keyboard shortcuts
- Subflows and reusable components

### Completion criteria

A user can build and operate this flow without editing source code:

```text
Upload Excel
→ Validate and clean data
→ Local Qwen analysis
→ Human approval
→ Generate PDF and PowerPoint
→ Store in MinIO
→ Send LINE notification
```

---

## Milestone 4: Multi-tenant SaaS and security

### Goal

Allow multiple organizations to use one deployment without sharing data, credentials, files, applications, or run history.

### SaaS foundation

- Organizations and workspaces
- User invitations
- Roles: Owner, Admin, Builder, Operator, Viewer
- Tenant-scoped PostgreSQL rows and object-storage prefixes
- Tenant-aware queues and worker limits
- API keys and service accounts
- Usage metering
- Quotas and rate limits
- Subscription and billing hooks

### Security

- Encrypted credential vault
- Key rotation
- CSRF tokens for state-changing browser operations
- Tenant-aware CORS and custom-domain policy
- File malware scanning
- Agent tool allowlists
- OpenClaw sandbox policy
- Tamper-evident audit events
- Secret masking
- Data retention and legal hold
- Export and deletion workflows

### Website Builder Pro

- Brand and theme editor
- Responsive device preview
- Public, login-required, and organization-only access modes
- Custom domains
- SEO metadata
- Draft, preview, staging, and production environments
- Form submission history
- Basic analytics
- Approval gates before publication

### Completion criteria

Two organizations can use the same deployment without seeing or affecting each other’s workflows, credentials, files, models, applications, usage, or run history.

---

## Milestone 5: Enterprise scale and ecosystem

### Goal

Support high availability, regulated environments, and third-party extensions.

### Scale and resilience

- Worker autoscaling
- Separate CPU, document, local LLM, GPU ML/DL, and agent pools
- Queue partitioning and priority classes
- PostgreSQL replication and automated backups
- Redis high availability
- Distributed MinIO/S3 deployment
- High-availability API instances
- Disaster recovery exercises
- Multi-region deployment
- Capacity and cost dashboards

### Identity and compliance

- OIDC, SAML, and LDAP
- Enterprise audit export
- Policy engine
- Data classification and residency controls
- Approval policies by workflow risk
- SLA/SLO reports
- Backup and recovery evidence

### Ecosystem

- Module SDK
- Signed module packages
- Private module registry
- Template marketplace
- Workflow marketplace
- Version compatibility contracts
- Community modules
- White-label deployment

### ML and model operations

- Dataset versioning
- Experiment tracking
- Training-job submission
- Model evaluation gates
- Model promotion between environments
- Inference deployment
- Drift and quality monitoring
- GPU scheduling and usage accounting

### Completion criteria

CherryFlow supports enterprise tenants, high availability, disaster recovery, external module developers, controlled model promotion, and commercial workflow distribution.

---

## Delivery order

```text
1. Operational visibility and hardening
2. Reliable execution controls
3. Workflow module expansion
4. Multi-tenant SaaS and security
5. Enterprise scale and ecosystem
```

The order prioritizes reliability, security, and tenant isolation before ecosystem and marketplace features.
