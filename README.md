# CherryFlow

**Local-first AI Workflow Platform for Qwen, OpenAI-compatible APIs, AI Agents, Machine Learning, and Deep Learning workloads.**

CherryFlow is designed to connect local AI infrastructure with real business workflows. It provides a controlled layer between websites, APIs, Qwen model servers, agents, data-processing modules, and future ML/DL worker pools.

> **Design principle:** AI proposes. CherryFlow validates and executes.

CherryFlow does not let an AI model generate and execute arbitrary browser JavaScript. The model returns a constrained UI Schema. CherryFlow validates the schema, renders approved React components, executes a validated workflow graph, stores run state, and publishes versioned applications.

---

## Project status

Current version: **0.3.0**

| Area | Status | Notes |
|---|---|---|
| Workflow graph engine | Available | DAG validation, cycle detection, ordered execution, per-node events |
| Module registry | Available | Built-in modules can be registered and executed by type |
| Qwen PDF report pipeline | Available | `report.qwen_pdf` flow node calls `skill_pdf` for code-rendered PDF reports when configured |
| Local deterministic planner | Available | Works without any external model |
| OpenAI-compatible provider | Available | Suitable for Qwen served by vLLM, SGLang, Ollama-compatible proxies, or similar servers |
| OpenClaw adapter | Available | Explicit HTTP bridge adapter |
| AI website generation | Available | Thai and English prompts |
| UI Schema validation | Available | Allowlisted components and binding validation |
| Preview, version, publish, rollback | Available | Published apps are available by slug |
| JSON persistence | Available for MVP | Data is stored in one local JSON file |
| PostgreSQL persistence | Planned | Phase 1 production milestone |
| Redis distributed workers | Planned | Phase 1 production milestone |
| MinIO/S3 file storage | Planned | Phase 1 production milestone |
| Visual drag-and-drop canvas | Planned | Phase 2 milestone |
| Authentication and RBAC | Planned | Phase 3 milestone |
| ML/DL worker pools and model registry | Planned | Phase 4 direction |

The repository is runnable today, but it is still an **MVP**. Do not treat the current JSON store and in-process execution model as production-ready infrastructure.

---

## What CherryFlow is

CherryFlow combines five layers:

1. **Local AI model access** — primarily Qwen through an OpenAI-compatible endpoint.
2. **Workflow orchestration** — validated nodes, edges, dependencies, and outputs.
3. **Module execution** — deterministic, AI, agent, document, ML, and DL modules.
4. **Application generation** — safe UI Schema rendered as a website or internal application.
5. **Runtime and publishing** — workflow execution, status polling, versioning, rollback, and public URLs.

Target architecture:

```text
User / Website / Internal App / Webhook / External API
                         ↓
                    CherryFlow API
                         ↓
       Workflow Contract + Graph Validation + Run State
                         ↓
                    Module Router
        ┌────────────────┼──────────────────┐
        ↓                ↓                  ↓
 Deterministic       Local Qwen         OpenClaw Agent
   Modules         OpenAI API Adapter       Bridge
        ↓                ↓                  ↓
 CPU / Document / Local LLM / GPU ML-DL / Agent Workers
                         ↓
        PostgreSQL + Redis + MinIO/S3 + Metrics
                         ↓
 Website / API / File / Database / Notification Output
```

The production worker and storage layers in this diagram are the target architecture. The current MVP executes workflows in the API process and persists data to JSON.

---

## Why Local Qwen

CherryFlow is optimized for private AI deployments where prompts, files, operational data, and model outputs should remain inside the customer environment.

Typical model-serving pattern:

```text
Qwen model
   ↓
vLLM / SGLang / Ollama / compatible inference server
   ↓
OpenAI-compatible HTTP API
   ↓
CherryFlow provider adapter
```

Benefits:

- Private prompts and files remain on local infrastructure.
- The model server can run on NVIDIA, AMD, Huawei Ascend, CPU, or another supported backend.
- CherryFlow is not tied to one inference engine.
- Model access is centralized behind the CherryFlow API.
- UI output is validated before it reaches the browser.
- Different workflows can later be routed to different model and worker pools.

The provider name `openai` in CherryFlow means **OpenAI-compatible API protocol**. It does not require using an externally hosted OpenAI model.

---

## Core runtime flow

```text
Prompt / API Request / Form Submission / Webhook
                         ↓
                  CherryFlow API
                         ↓
          Workflow Contract and Graph
                         ↓
             Module Registry Lookup
                         ↓
           Topological Node Execution
                         ↓
       Per-node running/completed/failed events
                         ↓
      Text / Markdown / Table / File / App Output
```

A workflow run moves through these states:

```text
queued → running → completed
                 ↘ failed
```

Each completed run can contain:

- Workflow inputs
- Final outputs
- Per-node execution events
- Created and updated timestamps
- Failure information when execution fails

---

## Repository structure

```text
CherryFlow/
├─ apps/
│  ├─ api/                         # Node.js HTTP API and workflow runtime
│  │  └─ src/
│  │     ├─ server.ts              # HTTP server and route dispatch
│  │     ├─ routes-builder.ts      # Modules, workflows, generation, refinement, validation
│  │     ├─ routes-publish.ts      # Save, versions, publish, rollback
│  │     ├─ routes-runtime.ts      # Workflow and published-app execution
│  │     ├─ planner.ts             # Provider selection and fallback
│  │     ├─ provider-openai.ts     # OpenAI-compatible model adapter
│  │     ├─ provider-openclaw.ts   # OpenClaw bridge adapter
│  │     ├─ local-planner.ts       # Deterministic zero-config planner
│  │     ├─ module-registry.ts     # Built-in executable modules
│  │     ├─ report-pdf-skill.ts    # Bridge from workflow node to skill_pdf Qwen PDF renderer
│  │     ├─ workflows.ts           # Workflow contracts and graphs
│  │     ├─ run-service.ts         # Run lifecycle and graph execution
│  │     └─ store.ts               # MVP JSON persistence
│  └─ web/                         # Next.js web application
│     ├─ app/                      # Homepage, builder, and published-app routes
│     └─ components/               # Builder and safe schema renderer
├─ packages/
│  ├─ ui-schema/                   # Workflow contracts, UI Schema, validation, run types
│  └─ workflow-engine/             # Graph validation, module registry, graph execution
├─ plugins/
│  └─ openclaw-adapter/            # OpenClaw client boundary
├─ skill_pdf/                      # Qwen JSON planner -> ReportLab PDF pipeline and tests
├─ docs/
│  ├─ architecture.md              # Current MVP architecture and security model
│  ├─ ai-providers.md              # AI provider configuration
│  ├─ local-ai-stack.md            # Local Qwen and ML/DL target architecture
│  └─ roadmap.md                   # Four-phase product roadmap
├─ docker-compose.yml              # Development PostgreSQL, Redis, and MinIO services
├─ .env.example                    # Environment variable template
└─ pnpm-workspace.yaml             # Monorepo workspace definition
```

---

## Requirements

- **Node.js 24 or newer**
- **pnpm 10 or newer**
- Optional: Docker and Docker Compose for PostgreSQL, Redis, and MinIO development services
- Optional: a local OpenAI-compatible model endpoint for Qwen

The repository declares `pnpm@10.12.1` as its package manager.

---

## Quick start: zero-configuration local planner

The local planner does not call an LLM. It creates deterministic, validated UI Schemas and is useful for development, demos, CI, and fallback behavior.

```bash
git clone https://github.com/paddman/CherryFlow.git
cd CherryFlow

corepack enable
pnpm install
cp .env.example .env

pnpm dev
```

Default environment:

```env
CHERRYFLOW_AI_PROVIDER=local
```

Open:

| Service | URL |
|---|---|
| Homepage | `http://localhost:3000` |
| AI Builder | `http://localhost:3000/builder` |
| API health | `http://localhost:4000/health` |
| Published application | `http://localhost:3000/apps/{slug}` |

Check the API:

```bash
curl http://localhost:4000/health
```

Expected shape:

```json
{
  "status": "ok",
  "service": "cherryflow-api",
  "aiProvider": "local"
}
```

---

## Quick start: Local Qwen through an OpenAI-compatible API

First run Qwen using the inference engine that matches your hardware. CherryFlow only requires an OpenAI-compatible `/v1/chat/completions` endpoint.

Before connecting CherryFlow, verify the model server directly:

```bash
curl http://localhost:8000/v1/models \
  -H "Authorization: Bearer local"
```

Test chat completion:

```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local" \
  -d '{
    "model": "qwen3.5-35b-a3b",
    "messages": [
      {"role": "user", "content": "ตอบว่า CherryFlow พร้อมใช้งาน"}
    ]
  }'
```

Configure CherryFlow:

```env
CHERRYFLOW_AI_PROVIDER=openai
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_API_KEY=local
OPENAI_MODEL=qwen3.5-35b-a3b
```

Then restart CherryFlow:

```bash
pnpm dev
```

CherryFlow sends requests to:

```text
{OPENAI_BASE_URL}/chat/completions
```

The model is instructed to return one JSON object matching CherryFlow UI Schema rules. The API normalizes and validates the response before sending it to the browser. Invalid model output falls back to a validated local schema.

### Model endpoint requirements

The configured endpoint should support:

- `POST /v1/chat/completions`
- JSON request and response bodies
- The configured model name
- Structured JSON output instructions
- An optional Bearer token

CherryFlow currently sends `response_format: { "type": "json_object" }`. Confirm that the serving stack accepts this field or has compatible behavior.

---

## AI provider modes

### 1. Local deterministic planner

```env
CHERRYFLOW_AI_PROVIDER=local
```

Use when:

- No model server is available
- Running CI or local tests
- Demonstrating the product without GPU infrastructure
- A deterministic fallback is preferred

### 2. OpenAI-compatible provider

```env
CHERRYFLOW_AI_PROVIDER=openai
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_API_KEY=local
OPENAI_MODEL=qwen3.5-35b-a3b
```

Use with:

- vLLM
- SGLang
- Ollama-compatible proxy layers
- Internal model gateways
- Any compatible Chat Completions implementation

### 3. OpenClaw bridge

```env
CHERRYFLOW_AI_PROVIDER=openclaw
OPENCLAW_BRIDGE_URL=http://localhost:18790
OPENCLAW_API_TOKEN=change-me
OPENCLAW_AGENT_ID=cherryflow-ui-builder
```

The bridge contract expects:

```text
POST /api/agents/run
GET  /api/agents/runs/:runId
```

The bridge is explicit by design. CherryFlow does not assume private OpenClaw Gateway frame formats.

---

## Environment variables

| Variable | Default / example | Purpose |
|---|---|---|
| `CHERRYFLOW_API_PORT` | `4000` | API listening port |
| `CHERRYFLOW_WEB_ORIGIN` | `http://localhost:3000` | Allowed web origin |
| `NEXT_PUBLIC_CHERRYFLOW_API_URL` | `http://localhost:4000` | API URL used by the browser |
| `CHERRYFLOW_DATA_FILE` | `./data/cherryflow.json` | MVP JSON persistence file |
| `CHERRYFLOW_MAX_BODY_MB` | `8` | Maximum JSON request body size |
| `CHERRYFLOW_AI_PROVIDER` | `local` | `local`, `openai`, or `openclaw` |
| `OPENAI_BASE_URL` | `http://localhost:8000/v1` | OpenAI-compatible model endpoint |
| `OPENAI_API_KEY` | optional | Bearer token for the model endpoint |
| `OPENAI_MODEL` | `qwen3.5-35b-a3b` | Model identifier sent to the endpoint |
| `OPENCLAW_BRIDGE_URL` | `http://localhost:18790` | OpenClaw bridge base URL |
| `OPENCLAW_API_TOKEN` | `change-me` | OpenClaw bridge token |
| `OPENCLAW_AGENT_ID` | `cherryflow-ui-builder` | Agent ID used by the adapter |
| `DATABASE_URL` | PostgreSQL URL | Reserved for PostgreSQL persistence work |
| `REDIS_URL` | `redis://localhost:6379` | Reserved for distributed workers |
| `S3_ENDPOINT` | `http://localhost:9000` | Reserved for MinIO/S3 storage |
| `S3_ACCESS_KEY` | `cherryflow` | MinIO/S3 access key |
| `S3_SECRET_KEY` | `change-me` | MinIO/S3 secret key |

> PostgreSQL, Redis, and S3 variables exist for the target architecture. The current MVP store still uses `CHERRYFLOW_DATA_FILE`.

---

## Optional development infrastructure

Start PostgreSQL 17, Redis 8, and MinIO:

```bash
docker compose up -d
```

Services:

| Service | Port | Purpose |
|---|---:|---|
| PostgreSQL | `5432` | Future durable application and run storage |
| Redis | `6379` | Future queue and distributed worker coordination |
| MinIO API | `9000` | Future uploaded-file and output-file storage |
| MinIO Console | `9001` | MinIO administration UI |

Stop services:

```bash
docker compose down
```

Remove development data:

```bash
docker compose down -v
```

The Compose services are currently infrastructure preparation. Starting them does not automatically replace the MVP JSON store.

---

## Key concepts

### Workflow Contract

A Workflow Contract defines the public input and output interface.

Example from `report-generator`:

```ts
{
  id: "report-generator",
  name: "AI Report Generator",
  inputs: [
    { name: "projectName", type: "text", required: true },
    { name: "department", type: "select", required: true },
    { name: "sourceFile", type: "file", required: true },
    { name: "notes", type: "textarea" }
  ],
  outputs: [
    { name: "summary", type: "markdown" },
    { name: "metrics", type: "table" },
    { name: "reportFile", type: "file" }
  ]
}
```

The contract is used by:

- The AI planner
- UI Schema binding validation
- Form rendering
- Output rendering
- Published applications

### Workflow Graph

A graph contains:

- `version`
- `nodes`
- `edges`
- `outputNodeId`

Current graph rules:

- At least one node is required
- Node IDs must be unique
- Module types must exist in the registry
- Edge endpoints must exist
- Self-referencing edges are rejected
- Duplicate edges are rejected
- Cycles are rejected
- The output node must exist

The engine calculates a topological execution order and passes direct dependency outputs to each node.

### Module

A module is a registered executable unit:

```ts
interface ModuleDefinition {
  type: string;
  label: string;
  description: string;
  run(context: ModuleContext): Promise<Record<string, unknown>> | Record<string, unknown>;
}
```

Module context contains:

- Original workflow inputs
- Node configuration
- Direct dependency outputs

### UI Schema

The AI does not return arbitrary HTML. It returns a constrained schema containing:

- Metadata
- Theme
- Page layout
- Allowlisted components
- Input bindings
- Output bindings

Allowed component types:

```text
navbar
hero
text
notice
stats
feature-grid
steps
faq
cta
footer
divider
workflow-form
job-progress
workflow-output
```

Important validation rules:

- Exactly one `workflow-form`
- Exactly one `workflow-output`
- At most one `job-progress`
- At most one `navbar`
- At most one `footer`
- Maximum 30 components
- Unique component IDs
- Input bindings must exist in the Workflow Contract
- Output bindings must exist in the Workflow Contract
- Theme colors must be six-digit hex values
- Navbar targets must be safe local anchors

### Published application

Publishing creates an immutable version and maps a sanitized slug to that version.

Rollback does not mutate old history. It creates a new draft copied from the selected version.

---

## Included workflow: AI Report Generator

Workflow ID:

```text
report-generator
```

Graph:

```text
core.input
    ├──────────────→ report.compose ──→ core.output
    ↓                      ↑
file.inspect ──────────────┘
```

Actual node sequence:

```text
input   → core.input
inspect → file.inspect
compose → report.compose
output  → core.output
```

Accepted file extensions in the Workflow Contract:

```text
.xlsx
.csv
.pdf
.txt
```

Current file-size limit for this workflow:

```text
5 MB
```

### Important MVP limitation

The current `report.compose` module is a demonstration module. It validates file metadata and creates a text summary, a metrics table, and a downloadable text report. It does **not yet parse Excel/PDF content or run real Qwen analysis**.

Real spreadsheet parsing, PDF extraction, OCR, Qwen analysis, and ML/DL modules are planned as separate modules.

---

## Built-in modules

| Module type | Purpose |
|---|---|
| `core.input` | Exposes workflow input values to downstream nodes |
| `file.inspect` | Validates an uploaded file and returns safe metadata |
| `report.compose` | Creates demonstration report outputs |
| `core.output` | Exposes an upstream node as the final workflow output |

List modules through the API:

```bash
curl http://localhost:4000/api/modules
```

---

## API reference and examples

Base URL:

```text
http://localhost:4000
```

### Health

```bash
curl http://localhost:4000/health
```

### List workflows

```bash
curl http://localhost:4000/api/workflows
```

### Read a workflow contract

```bash
curl http://localhost:4000/api/workflows/report-generator
```

### Read and validate a workflow graph

```bash
curl http://localhost:4000/api/workflows/report-generator/graph
```

Response includes:

```json
{
  "graph": {},
  "validation": {
    "valid": true,
    "errors": [],
    "order": ["input", "inspect", "compose", "output"]
  }
}
```

### Generate a website schema

```bash
curl -X POST http://localhost:4000/api/workflows/report-generator/ui/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "สร้างเว็บไซต์รายงานข้อมูลภาษาไทย สไตล์องค์กร เน้น Local Qwen และ AI Analytics"
  }'
```

The response contains the generated schema, provider information, and validation result.

### Refine a website schema

Save the generated schema to `schema.json`, then submit it with a new prompt:

```bash
curl -X POST http://localhost:4000/api/workflows/report-generator/ui/refine \
  -H "Content-Type: application/json" \
  --data-binary @refine-request.json
```

Example `refine-request.json`:

```json
{
  "prompt": "เปลี่ยนเป็นสีน้ำเงินเข้ม เพิ่ม FAQ และสถิติ 3 ช่อง",
  "schema": {
    "version": "1.0",
    "workflowId": "report-generator",
    "meta": { "name": "Report App" },
    "theme": {
      "primaryColor": "#1769e0",
      "backgroundColor": "#eef5ff",
      "surfaceColor": "#ffffff",
      "textColor": "#12213a",
      "radius": "large",
      "density": "comfortable"
    },
    "page": {
      "title": "Report App",
      "layout": "full-width",
      "components": [
        {
          "id": "form",
          "type": "workflow-form",
          "fields": ["projectName", "department", "sourceFile", "notes"],
          "submitLabel": "สร้างรายงาน"
        },
        {
          "id": "output",
          "type": "workflow-output",
          "bindings": ["summary", "metrics", "reportFile"]
        }
      ]
    }
  }
}
```

### Validate a UI Schema

```bash
curl -X POST http://localhost:4000/api/workflows/report-generator/ui/validate \
  -H "Content-Type: application/json" \
  --data-binary @validate-request.json
```

### Start a workflow run

The API represents uploaded files as a data URL object.

```bash
curl -X POST http://localhost:4000/api/workflows/report-generator/runs \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "projectName": "Local AI Test",
      "department": "technology",
      "sourceFile": {
        "name": "demo.txt",
        "type": "text/plain",
        "size": 16,
        "dataUrl": "data:text/plain;base64,SGVsbG8gQ2hlcnJ5Rmxvdw=="
      },
      "notes": "ทดสอบ Workflow Graph"
    }
  }'
```

The API returns HTTP `202` with a queued run.

### Poll a run

```bash
curl http://localhost:4000/api/runs/{runId}
```

Completed run shape:

```json
{
  "run": {
    "id": "...",
    "workflowId": "report-generator",
    "status": "completed",
    "inputs": {},
    "outputs": {
      "summary": "...",
      "metrics": [],
      "reportFile": {}
    },
    "steps": [
      {
        "nodeId": "input",
        "moduleType": "core.input",
        "status": "completed",
        "at": "..."
      }
    ]
  }
}
```

### Save a draft version

```text
POST /api/workflows/:workflowId/ui/save
```

Request:

```json
{
  "schema": {},
  "prompt": "Original generation prompt"
}
```

### List versions

```bash
curl http://localhost:4000/api/workflows/report-generator/ui/versions
```

### Publish an application

```text
POST /api/workflows/:workflowId/ui/publish
```

Request:

```json
{
  "schema": {},
  "prompt": "Original generation prompt",
  "slug": "local-ai-report"
}
```

Published URL:

```text
http://localhost:3000/apps/local-ai-report
```

### Run a published application through API

```text
POST /api/apps/:slug/run
```

### Roll back from a version

```text
POST /api/workflows/:workflowId/ui/rollback
```

Request:

```json
{
  "versionId": "version-id"
}
```

---

## Development commands

Run API and web applications in parallel:

```bash
pnpm dev
```

Run TypeScript checks:

```bash
pnpm typecheck
```

Run tests:

```bash
pnpm test
```

Build all packages and applications:

```bash
pnpm build
```

Run the complete validation sequence:

```bash
pnpm check
```

The root scripts execute commands recursively across workspace packages.

---

## Testing and CI

GitHub Actions currently validates:

1. Dependency installation
2. TypeScript checks
3. Unit tests
4. Production build

Existing test coverage includes:

- Workflow graph ordering
- Unknown module validation
- Cycle detection
- Workflow execution
- Complete website UI Schema validation
- Unsafe navigation target rejection

Future production work should add:

- API integration tests
- Persistence adapter tests
- Queue retry and timeout tests
- Multi-tenant security tests
- Browser end-to-end tests
- Model-provider compatibility tests
- Worker and object-storage failure tests

---

## Current security controls

Implemented controls:

- Allowlisted UI component types
- Input and output binding validation
- Unique component ID validation
- Theme color validation
- Local-only navbar anchor validation
- Request body-size limit
- Browser and API file-size checks
- Provider credentials kept server-side
- No `dangerouslySetInnerHTML`
- Published slug sanitization
- Invalid AI output rejection and local fallback
- Workflow graph cycle and edge validation

Production hardening still required:

- Authentication and session management
- Workspaces and tenant isolation
- Role-based access control
- API key lifecycle management
- CSRF protection
- Restrictive production CORS policy
- Rate limits and quotas
- Encrypted credential storage
- Malware scanning
- Audit export and retention policy
- OpenClaw tool allowlists and sandbox policy
- Secret masking across logs and browser payloads

---

## Machine Learning and Deep Learning direction

CherryFlow will treat ML and DL features as modules and worker jobs, not as logic embedded directly into the workflow engine.

### Planned data modules

- CSV and Excel loading
- PDF extraction
- Data cleaning
- Missing-value handling
- Feature selection
- Encoding and normalization
- Train/test split

### Planned classical ML modules

- Classification
- Regression
- Clustering
- Anomaly detection
- Time-series forecasting
- Model evaluation

### Planned deep-learning modules

- OCR and document understanding
- Image classification
- Object detection
- Speech-to-text
- Text classification
- Embedding generation
- Fine-tuning job submission

### Planned MLOps modules

- Dataset versioning
- Training jobs
- Experiment tracking
- Model registry
- Inference deployment
- Model metrics
- Drift monitoring
- GPU scheduling and usage accounting

Target worker routing:

```text
CherryFlow API
      ↓
Redis Queue
      ↓
Worker Router
  ├─ General CPU Worker
  ├─ Document Worker
  ├─ Local LLM Worker
  ├─ GPU ML/DL Worker
  └─ Agent Worker
      ↓
PostgreSQL + MinIO/S3 + Metrics
```

Each future module should declare its resource requirements so the router can select the correct worker pool.

---

## MVP limitations

The following limitations are intentional and must be understood before deployment:

- Persistence is a local JSON file.
- Workflow execution uses `setTimeout` and runs inside the API process.
- There is no durable distributed queue.
- Restarting during an active run can interrupt that run.
- Uploaded files are represented as data URLs in JSON.
- There is no object storage integration yet.
- There is no authentication or tenant isolation.
- The included report workflow does not perform real spreadsheet/PDF parsing.
- ML and DL modules are architecture direction, not current implementation.
- The visual Flow tab is not yet a full drag-and-drop workflow editor.
- Production monitoring, tracing, alerting, and HA are not yet included.

---

## Troubleshooting

### API health works but the Builder cannot connect

Check:

```env
NEXT_PUBLIC_CHERRYFLOW_API_URL=http://localhost:4000
CHERRYFLOW_WEB_ORIGIN=http://localhost:3000
```

Restart the Next.js development server after changing a `NEXT_PUBLIC_*` variable.

### Model endpoint returns HTTP 404

Confirm that `OPENAI_BASE_URL` includes `/v1` only when required by the model server.

Correct common pattern:

```env
OPENAI_BASE_URL=http://localhost:8000/v1
```

CherryFlow appends `/chat/completions`.

### Model endpoint returns HTTP 401

Set the correct token:

```env
OPENAI_API_KEY=your-token
```

If the local server does not require authentication, leave the variable unset.

### AI response is rejected

The provider must return JSON matching the UI Schema rules. CherryFlow rejects HTML, JavaScript, unknown components, invalid bindings, unsafe anchors, and malformed theme values.

Check model logs and ensure the endpoint supports JSON-object output instructions.

### File exceeds the limit

The demonstration report workflow limits files to 5 MB. The global JSON body limit defaults to 8 MB. Base64 data URLs are larger than the original file, so keep test files comfortably below both limits.

### Workflow fails with `Missing dependency output`

Check that:

- The required edge exists
- The configured node ID matches the upstream node
- The upstream module completed successfully

### Workflow graph is rejected as cyclic

CherryFlow only supports directed acyclic graphs in the current engine. Remove loops and model repeated behavior using future control-flow modules or explicit run orchestration.

### Build fails after dependency changes

Run:

```bash
corepack enable
pnpm install
pnpm check
```

---

## Roadmap

Detailed roadmap: [`docs/roadmap.md`](docs/roadmap.md)

### Phase 1 — Production Core

- PostgreSQL migrations and persistence
- Redis/BullMQ workers
- Retry, timeout, cancel, and resume
- Per-node durable logs
- MinIO/S3 file storage
- Health checks and production Compose deployment

### Phase 2 — Visual Workflow and Core Modules

- Drag-and-drop canvas
- Node configuration
- Triggers and schedules
- HTTP, database, document, LLM, agent, approval, LINE, and email modules
- Single-node testing and run-from-node

### Phase 3 — SaaS, Security, and Website Builder Pro

- Authentication
- Workspaces
- RBAC
- Tenant isolation
- Credential vault
- Quotas
- Audit logs
- Custom domains
- Themes and environments

### Phase 4 — Enterprise Scale and Ecosystem

- Worker autoscaling
- CPU/GPU worker pools
- High availability and disaster recovery
- SSO
- Billing
- Module SDK
- Private module registry
- Template and workflow marketplace
- Dataset, experiment, and model operations

---

## Related documentation

- [`docs/architecture.md`](docs/architecture.md) — current architecture and included security controls
- [`docs/ai-providers.md`](docs/ai-providers.md) — local, OpenAI-compatible, and OpenClaw providers
- [`docs/local-ai-stack.md`](docs/local-ai-stack.md) — Local Qwen and ML/DL target architecture
- [`docs/roadmap.md`](docs/roadmap.md) — four-phase implementation roadmap

---

## Contribution workflow

Before opening a pull request:

```bash
pnpm check
```

Recommended pull-request scope:

- One production milestone or cohesive feature per branch
- Tests for graph, schema, route, or module behavior
- README and architecture updates when contracts change
- No secrets, model tokens, uploaded datasets, or generated runtime data in commits

Suggested branch naming:

```text
feature/<short-name>
fix/<short-name>
docs/<short-name>
```

---

## Product direction summary

CherryFlow is not only a website generator and not only a generic workflow editor.

The target product is:

```text
Local Qwen + Standard AI API + Workflow Engine + Agent Runtime
+ Machine Learning Modules + Deep Learning Workers
+ Safe Website/API Publishing + Enterprise Operations
```

The API boundary remains model-independent, while the primary product experience is optimized for private Local Qwen infrastructure.
