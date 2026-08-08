# CherryFlow

**Local-first AI workflow platform for Qwen, OpenAI-compatible APIs, AI agents, document automation, Machine Learning, and GPU worker pools.**

CherryFlow sits between applications, model servers, files, agents, and business processes. It validates what AI proposes, executes an allowlisted workflow graph, stores run state, and publishes versioned applications without allowing a model to inject arbitrary browser JavaScript.

> **Core rule:** AI proposes. CherryFlow validates and executes.

---

## Current capability snapshot

CherryFlow is an active MVP with several production foundations already implemented. The default mode remains lightweight for local development, while PostgreSQL, Redis, MinIO/S3, RBAC, pgvector memory, and model registry features can be enabled when needed.

| Area | Current status |
|---|---|
| Workflow graph engine | DAG validation, cycle detection, execution order, per-node state, and final outputs |
| Visual Workflow Canvas | Drag-and-drop nodes, connections, configuration, validation, run, import, and export |
| AI application builder | Generate/refine validated UI Schema, preview, save, publish, version, and rollback |
| Operational Control Center | Runtime configuration, workflow inventory, versions, models, worker pools, and user totals |
| Local Qwen / OpenAI-compatible API | Local deterministic mode plus vLLM, SGLang, Ollama-compatible, and internal gateways |
| Agent integration | CherryAgent tools and explicit OpenClaw HTTP bridge adapter |
| Document pipeline | Excel, CSV, PDF, and text extraction with PDF, DOCX, PPTX, HTML, and downloadable output support |
| Qwen PDF skill | Optional Python/ReportLab report renderer with deterministic fallback |
| Persistence | Local JSON by default; PostgreSQL with ordered migrations when enabled |
| Run queue | In-process by default; Redis-backed queue when enabled |
| File storage | Inline payloads by default; MinIO/S3 object storage when fully configured |
| Authentication and RBAC | Session login with `admin`, `editor`, and `viewer` roles |
| AI memory | PostgreSQL + pgvector memory API with local or OpenAI-compatible embeddings |
| Model registry | Model endpoint sync, capability tags, availability state, and worker-pool metadata |
| CI | TypeScript checks, tests, and production builds on pushes and pull requests |

CherryFlow is not yet a complete multi-tenant SaaS product. See [Production boundaries](#production-boundaries) before exposing it outside a controlled environment.

---

## Product surfaces

After starting the API and web applications, open:

| Surface | URL | Purpose |
|---|---|---|
| Homepage | `http://localhost:3000` | Product entry point and architecture overview |
| Control Center | `http://localhost:3000/dashboard` | Operational status and inventory |
| AI App Builder | `http://localhost:3000/builder` | Generate, refine, preview, version, and publish applications |
| Workflow Canvas | `http://localhost:3000/canvas` | Edit and execute the workflow graph visually |
| Business Process Builder | `http://localhost:3000/process-builder` | Design swimlane-style business processes |
| Model Registry | `http://localhost:3000/models` | Sync models and inspect worker pools |
| Published application | `http://localhost:3000/apps/{slug}` | Run a published workflow UI |
| API health | `http://localhost:4000/health` | Runtime mode summary |

Management surfaces require a CherryFlow session. The homepage and published applications remain public by design.

---

## Architecture

```text
Browser / Internal App / Webhook / External API
                         ↓
                    CherryFlow API
                         ↓
       Authentication + Contract + Graph Validation
                         ↓
                    Module Registry
        ┌────────────────┼──────────────────┐
        ↓                ↓                  ↓
 Deterministic       Local Qwen         Agent Bridge
   Modules        OpenAI-compatible     CherryAgent /
                   API Adapter           OpenClaw
        ↓                ↓                  ↓
 Document / CPU / Local LLM / GPU ML-DL / Agent Work
                         ↓
      JSON or PostgreSQL + Redis + MinIO/S3 + pgvector
                         ↓
      Application / API / File / Notification Output
                         ↓
              Operational Control Center
```

The workflow engine receives a constrained graph. Every node type must exist in the module registry, edges must reference real nodes, cycles are rejected, and the output node must be valid before execution begins.

The website builder follows the same approach. A model returns a constrained UI Schema, not arbitrary HTML or JavaScript. CherryFlow validates the schema and renders allowlisted React components.

---

## Repository structure

```text
CherryFlow/
├─ apps/
│  ├─ api/                         # Node.js API, workflow runtime, storage, auth, memory
│  │  ├─ migrations/               # Ordered PostgreSQL migrations
│  │  └─ src/
│  │     ├─ server.ts              # HTTP entry point and route dispatch
│  │     ├─ overview.ts            # Safe operational overview payload
│  │     ├─ routes-*.ts            # Auth, builder, runtime, publish, agent, memory, overview
│  │     ├─ module-registry.ts     # Executable workflow modules
│  │     ├─ run-service.ts         # Run lifecycle and graph execution
│  │     ├─ store.ts               # JSON/PostgreSQL persistence adapter
│  │     ├─ redis-queue.ts         # Optional Redis run queue
│  │     ├─ file-storage.ts        # Inline or MinIO/S3 storage
│  │     └─ memory-store.ts        # pgvector AI memory
│  └─ web/                         # Next.js web application
│     ├─ app/dashboard/            # Operational Control Center
│     ├─ app/builder/              # AI application builder
│     ├─ app/canvas/               # Visual workflow editor
│     ├─ app/process-builder/      # Business process editor
│     ├─ app/models/               # Model registry UI
│     └─ components/               # Auth gate and safe schema renderer
├─ packages/
│  ├─ ui-schema/                   # Workflow contracts, UI Schema, validation, run types
│  └─ workflow-engine/             # Graph validation, registry, and execution
├─ plugins/openclaw-adapter/       # Explicit OpenClaw HTTP boundary
├─ skill_pdf/                      # Qwen JSON planner + ReportLab PDF pipeline
├─ docs/                           # Architecture and operating documentation
├─ docker-compose.yml              # PostgreSQL/pgvector, Redis, and MinIO development stack
└─ .env.example                    # Safe local defaults and optional backend examples
```

---

## Requirements

- Node.js 24 or newer
- pnpm 10 or newer
- Optional Docker Compose for PostgreSQL/pgvector, Redis, and MinIO
- Optional OpenAI-compatible model endpoint for Qwen or another model
- Optional Python 3 for the Qwen PDF skill

The repository declares `pnpm@10.12.1`.

---

## Quick start

```bash
git clone https://github.com/paddman/CherryFlow.git
cd CherryFlow

corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
```

Change the bootstrap password before starting anything that another human can reach:

```env
CHERRYFLOW_ADMIN_USER=cherryflow-admin
CHERRYFLOW_ADMIN_PASSWORD=replace-with-a-strong-password
```

Start both applications:

```bash
pnpm dev
```

The workspace scripts load the root `.env` file automatically. The safe default uses:

```env
CHERRYFLOW_STORE=json
CHERRYFLOW_RUNNER=in_process
CHERRYFLOW_AI_PROVIDER=local
```

This mode does not require Docker or a model server.

Check the API:

```bash
curl http://localhost:4000/health
```

Expected shape:

```json
{
  "status": "ok",
  "service": "cherryflow-api",
  "aiProvider": "local",
  "embeddingProvider": "local",
  "store": "json",
  "runner": "in_process",
  "fileStorage": "inline",
  "memory": "disabled"
}
```

Then sign in at `http://localhost:3000/dashboard`.

---

## Enable PostgreSQL, Redis, MinIO, and pgvector

Start the development infrastructure:

```bash
docker compose up -d
```

Enable PostgreSQL and Redis in `.env`:

```env
CHERRYFLOW_STORE=postgres
DATABASE_URL=postgresql://cherryflow:cherryflow@127.0.0.1:5432/cherryflow

CHERRYFLOW_RUNNER=redis
REDIS_URL=redis://127.0.0.1:6379
```

Enable MinIO/S3 object storage by setting every required value:

```env
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=cherryflow
S3_ACCESS_KEY_ID=cherryflow
S3_SECRET_ACCESS_KEY=change-me-now
S3_FORCE_PATH_STYLE=true
```

When PostgreSQL is enabled, CherryFlow applies pending migrations at startup by default. For controlled deployments:

```env
CHERRYFLOW_AUTO_MIGRATE=false
```

Then run migrations explicitly:

```bash
pnpm db:status
pnpm db:migrate
pnpm db:check
```

AI memory becomes available when PostgreSQL/pgvector is configured. Embeddings can remain deterministic and local or use an OpenAI-compatible embeddings endpoint.

---

## Connect Local Qwen

Run Qwen using the serving stack that matches the hardware, then configure CherryFlow with an OpenAI-compatible endpoint:

```env
CHERRYFLOW_AI_PROVIDER=openai
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_API_KEY=local
OPENAI_MODEL=qwen3.5-35b-a3b
OPENAI_RESPONSE_FORMAT=json_object
```

Verify the model server first:

```bash
curl http://localhost:8000/v1/models \
  -H "Authorization: Bearer local"
```

CherryFlow sends chat requests to:

```text
{OPENAI_BASE_URL}/chat/completions
```

The adapter works with compatible vLLM, SGLang, Ollama proxy, and internal gateway deployments. Invalid or malformed UI output is rejected and can fall back to the local deterministic planner.

---

## AI provider modes

### Local deterministic

```env
CHERRYFLOW_AI_PROVIDER=local
```

Useful for development, CI, demos, and predictable fallback behavior.

### OpenAI-compatible

```env
CHERRYFLOW_AI_PROVIDER=openai
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_API_KEY=local
OPENAI_MODEL=qwen3.5-35b-a3b
```

The word `openai` describes the API protocol. It does not require an externally hosted model.

### OpenClaw bridge

```env
CHERRYFLOW_AI_PROVIDER=openclaw
OPENCLAW_BRIDGE_URL=http://localhost:18790
OPENCLAW_API_TOKEN=replace-me
OPENCLAW_AGENT_ID=cherryflow-ui-builder
```

Expected bridge routes:

```text
POST /api/agents/run
GET  /api/agents/runs/:runId
```

---

## Included workflow

The built-in workflow ID is:

```text
report-generator
```

Current graph:

```text
core.input
    ├──────────────→ report.compose ─────────────┐
    ↓                      ↑                     ↓
file.inspect ──────────────┘              report.qwen_pdf
                                                  ↓
                                             core.output
```

The workflow accepts Excel, CSV, PDF, and text files, extracts real content, computes metrics, composes a structured report, optionally calls the Qwen PDF skill, and returns preview, summary, table, and downloadable file outputs.

---

## Authentication and roles

CherryFlow bootstraps the first administrator from:

```env
CHERRYFLOW_ADMIN_USER=cherryflow-admin
CHERRYFLOW_ADMIN_PASSWORD=replace-me
CHERRYFLOW_SESSION_DAYS=7
```

Roles:

| Role | Intended access |
|---|---|
| `viewer` | Read operational overview, workflows, graphs, canvases, models, and worker pools |
| `editor` | Modify workflows, run builder operations, sync models, and use agent management routes |
| `admin` | Editor access plus user management |

Sessions use an HTTP-only cookie and PBKDF2 password hashing. Set `CHERRYFLOW_WEB_ORIGIN` to an HTTPS origin in production so the session cookie receives the `Secure` attribute.

---

## Operational Control Center API

The dashboard reads a safe, authenticated summary from:

```text
GET /api/overview
```

It includes:

- Runtime configuration mode
- Workflow and module totals
- Saved Canvas count
- Draft and published version totals
- Model and worker-pool state
- RBAC user count
- Safe recent version metadata

It intentionally excludes password hashes, session tokens, prompts, UI schemas, workflow inputs, workflow outputs, and provider credentials.

The Control Center refreshes every 30 seconds. Runtime cards describe configured modes; they are not synthetic connectivity checks for every external dependency.

---

## Main API routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/health` | Public runtime mode summary |
| `GET` | `/api/auth/session` | Current session |
| `POST` | `/api/auth/login` | Create session |
| `POST` | `/api/auth/logout` | Revoke session |
| `GET/POST` | `/api/auth/users` | Admin user management |
| `GET` | `/api/overview` | Authenticated operational overview |
| `GET` | `/api/modules` | Module registry |
| `GET` | `/api/workflows` | Workflow contracts |
| `GET` | `/api/workflows/:id/graph` | Graph and validation result |
| `GET/PUT` | `/api/workflows/:id/canvas` | Read or save visual Canvas |
| `POST` | `/api/workflows/:id/canvas/validate` | Validate edited graph |
| `POST` | `/api/workflows/:id/canvas/run` | Execute edited graph |
| `GET/POST` | `/api/workflows/:id/canvas/export` / `import` | Flow package exchange |
| `POST` | `/api/workflows/:id/ui/generate` | Generate validated application schema |
| `POST` | `/api/workflows/:id/ui/refine` | Refine existing schema |
| `POST` | `/api/workflows/:id/ui/save` | Save draft version |
| `POST` | `/api/workflows/:id/ui/publish` | Publish immutable version and slug |
| `POST` | `/api/workflows/:id/ui/rollback` | Create draft from an older version |
| `POST` | `/api/workflows/:id/runs` | Start workflow run |
| `GET` | `/api/runs/:runId` | Poll run state |
| `GET` | `/api/apps/:slug` | Read published app |
| `POST` | `/api/apps/:slug/run` | Run published app |
| `GET/POST` | `/api/models`, `/api/models/sync` | Model registry and endpoint sync |
| `GET` | `/api/worker-pools` | Worker-pool metadata |

See the route source and documents under `docs/` for the complete contracts.

---

## Development commands

```bash
pnpm dev          # API and web in parallel
pnpm typecheck    # TypeScript checks across workspaces
pnpm test         # Unit tests
pnpm build        # Production builds/type builds
pnpm check        # typecheck + test + build

pnpm db:status
pnpm db:migrate
pnpm db:check
```

CI runs `pnpm install --frozen-lockfile` followed by `pnpm check`.

---

## Security controls already present

- Allowlisted UI component types
- Workflow input/output binding validation
- Unique component ID and safe local navigation validation
- Graph node, edge, output, duplicate, and cycle validation
- Request and workflow file-size limits
- Server-side provider credentials
- No arbitrary AI-generated browser JavaScript
- Published slug sanitization
- PBKDF2 passwords and hashed session tokens
- HTTP-only, SameSite session cookie
- Role checks for management APIs
- Next.js response headers for clickjacking, MIME sniffing, referrer, camera, microphone, and geolocation restrictions
- Safe operational overview payload that omits credentials and workflow data

---

## Production boundaries

The following remain important before commercial or internet-facing deployment:

- No organization/workspace multi-tenancy or tenant isolation
- No API-key lifecycle, quotas, rate limits, or usage metering
- No encrypted credential vault or secret rotation workflow
- No complete audit-log and retention subsystem
- No dedicated CSRF-token mechanism for same-site hostile applications
- Redis execution is configurable, but the current worker loop still starts inside the API service
- No retry, timeout, cancel, resume, or dead-letter controls for all node types
- No scheduler/cron trigger service
- No full observability stack, distributed tracing, SLA dashboard, or failure alerting
- No built-in HA, database replication, backup automation, or disaster recovery orchestration
- No malware scanning pipeline for uploaded files
- Published-app access policies and run-result authorization need hardening for broader SaaS use
- Model and infrastructure status in the dashboard is configuration/inventory data, not a substitute for active probes and metrics

Use JSON/in-process mode for local development. Use PostgreSQL, Redis, S3, HTTPS, strong credentials, restricted network access, backups, and external monitoring for controlled production pilots.

---

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — architecture and trust boundaries
- [`docs/ai-providers.md`](docs/ai-providers.md) — Local, OpenAI-compatible, and OpenClaw modes
- [`docs/ai-memory.md`](docs/ai-memory.md) — PostgreSQL/pgvector memory
- [`docs/database-migrations.md`](docs/database-migrations.md) — migration lifecycle
- [`docs/openclaw-integration.md`](docs/openclaw-integration.md) — explicit agent bridge
- [`docs/tool-calling.md`](docs/tool-calling.md) — CherryAgent tool execution
- [`docs/GUI_REFRESH_2026.md`](docs/GUI_REFRESH_2026.md) — interface design decisions
- [`docs/roadmap.md`](docs/roadmap.md) — delivered foundations and next milestones

---

## Contribution workflow

Before opening a pull request:

```bash
pnpm check
```

Keep each branch focused, include tests when behavior changes, update documentation when contracts change, and never commit model tokens, customer files, runtime databases, or generated secrets.

Suggested branch names:

```text
feature/<short-name>
fix/<short-name>
docs/<short-name>
```

---

## Product direction

```text
Local Qwen + Standard AI APIs + Validated Workflow Engine
+ Agent Runtime + Document Automation + ML/DL Worker Pools
+ Safe Application Publishing + Operational Control Center
```

CherryFlow is intended to make private AI infrastructure usable as a controlled business platform rather than a disconnected collection of model endpoints, scripts, and operator tools.
