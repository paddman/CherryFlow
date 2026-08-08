# CherryFlow Architecture

## Design principle

**AI proposes. CherryFlow validates and executes.**

A model never writes or executes arbitrary browser JavaScript. It returns constrained data such as UI Schema, structured report plans, or agent requests. CherryFlow validates that data against explicit contracts and executes only registered modules and allowlisted components.

---

## System overview

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

---

## Web application

The Next.js application provides separate operator surfaces:

- `/dashboard` — operational configuration and inventory
- `/builder` — AI-generated application schema, preview, versioning, and publication
- `/canvas` — visual Workflow Graph editing and execution
- `/process-builder` — swimlane-style business process design
- `/models` — model registry and worker pools
- `/apps/:slug` — published workflow application

Management pages use the shared `AuthGate` session boundary. Published applications and the marketing homepage remain public by design.

The web layer renders normal React components. Generated strings are treated as data. The implementation does not use `dangerouslySetInnerHTML` for AI-generated content.

---

## API request lifecycle

```text
HTTP request
    ↓
CORS headers / preflight handling
    ↓
Public health or authentication routes
    ↓
Role authorization for management routes
    ↓
Route handler
    ↓
Contract and payload validation
    ↓
Store / queue / model / module operation
    ↓
JSON response or file stream
```

The API is implemented with Node.js `http` and explicit route handlers rather than a web framework. Request bodies are bounded by `CHERRYFLOW_MAX_BODY_MB`.

---

## Authentication and authorization

CherryFlow bootstraps the first administrator from environment variables. Passwords use PBKDF2 with a per-user random salt. Session tokens are random, only their SHA-256 hashes are stored, and the browser receives an HTTP-only SameSite cookie.

Roles:

- `viewer` — read management inventory and definitions
- `editor` — modify workflows, generate/publish UI, sync models, and use agent management routes
- `admin` — editor access plus user management

The current model is deployment-wide RBAC. Organization and tenant isolation are future milestones.

---

## Workflow contracts

A `WorkflowContract` defines the public interface:

- Workflow ID, name, and description
- Typed input fields
- Typed outputs

The contract is shared by:

- Builder prompt planning
- UI Schema validation
- Published form rendering
- Input handling
- Output rendering
- Workflow API documentation

Input and output bindings in a generated UI must exist in the contract.

---

## Workflow graph

A graph contains:

- Version
- Nodes
- Directed edges
- Output node ID

Validation rejects:

- Unsupported graph versions
- Empty graphs
- Missing or duplicate node IDs
- Unknown module types
- Missing edge endpoints
- Self-referencing edges
- Duplicate edges
- Cycles
- Invalid output nodes

The engine calculates a topological order and passes direct upstream outputs to each node.

---

## Module registry

A module is an allowlisted executable unit with:

- Stable type identifier
- Human-readable label and description
- Runtime implementation

Current modules cover workflow input/output, file inspection, report composition, optional Qwen PDF rendering, CherryAgent, and OpenClaw execution.

A model cannot invent a module type at runtime. The graph is rejected unless every node exists in the registry.

---

## AI provider boundary

### Local deterministic

`CHERRYFLOW_AI_PROVIDER=local`

Provides zero-configuration, predictable behavior for development, CI, and fallback operation.

### OpenAI-compatible

`CHERRYFLOW_AI_PROVIDER=openai`

Calls a server-side Chat Completions endpoint such as vLLM, SGLang, an Ollama-compatible gateway, or an internal model router. Credentials remain on the API server.

### OpenClaw

`CHERRYFLOW_AI_PROVIDER=openclaw`

Uses an explicit HTTP bridge contract rather than depending on private gateway frame formats.

Provider output is normalized and validated before it reaches the browser or workflow runtime.

---

## UI Schema and publication

The application builder stores a constrained schema containing:

- Metadata
- Theme
- Page layout
- Allowlisted components
- Input bindings
- Output bindings

Validation includes component counts, unique IDs, theme color format, safe local navigation targets, and contract binding checks.

Publishing creates an immutable version and maps a sanitized slug to that version. Rollback creates a new draft copied from an earlier version; history is not mutated.

---

## Run lifecycle

```text
queued → running → completed
                 ↘ failed
```

A run stores:

- Workflow ID
- Inputs
- Creation and update times
- Current status
- Per-node events
- Outputs or error

Execution can run inside the API process or through a Redis-backed queue. The current Redis worker loop starts from the API service; separating the worker into its own deployable service is a roadmap item.

---

## Persistence

### JSON mode

The default mode stores versions, published applications, runs, canvases, users, sessions, models, and worker pools in a local JSON file. Writes are serialized and use a temporary-file rename.

Use this mode for local development and controlled demos.

### PostgreSQL mode

PostgreSQL provides durable storage and ordered migrations. Startup can apply pending migrations automatically or fail until an operator runs them explicitly.

PostgreSQL also enables pgvector AI memory.

---

## Queue and worker pools

Redis can hold run IDs for asynchronous execution. Model registry data describes worker pools, concurrency, assigned models, endpoints, and current reported state.

Worker-pool records are inventory and routing metadata. They do not yet provide complete autoscaling, leases, retries, heartbeats, or SLA enforcement.

---

## File storage

Without S3 configuration, uploaded and generated files can use inline payloads.

When MinIO/S3 endpoint and credentials are configured, CherryFlow stores objects outside the API process and returns object-backed file references. Object names are sanitized and receive generated keys.

Retention policies, antivirus scanning, signed URL policy, and tenant-scoped object prefixes remain future hardening work.

---

## AI memory

AI memory uses PostgreSQL and pgvector. Records contain:

- Namespace
- Optional source ID
- Content
- Metadata
- Embedding provider and model
- Creation and update times

Embeddings can use a deterministic local provider or an OpenAI-compatible embeddings endpoint. Search supports namespace, limit, and minimum-score controls.

---

## Operational overview

`GET /api/overview` provides the Dashboard with a safe summary:

- Runtime configuration modes
- Workflow, Canvas, module, and version totals
- Model and worker-pool inventory
- RBAC user count
- Recent version identifiers and timestamps

The payload deliberately excludes credentials, password hashes, session tokens, prompts, schemas, workflow inputs, and workflow outputs.

Runtime mode is configuration data. Active dependency probes and metrics are separate roadmap items.

---

## Security controls included

- Constrained UI Schema and component allowlist
- Workflow graph and module allowlist
- Input/output binding validation
- Safe navigation target checks
- Request and file-size limits
- Server-side provider secrets
- PBKDF2 password hashes
- Hashed session tokens
- HTTP-only SameSite cookies
- Role checks on management routes
- Sanitized published slugs and object names
- No AI-generated executable browser code
- Browser response headers against clickjacking, MIME sniffing, and unnecessary device permissions

---

## Production hardening still required

- Organization and tenant isolation
- API keys, quotas, rate limits, and usage metering
- Encrypted credential vault and rotation
- Audit log, retention, and export
- Dedicated CSRF-token mechanism
- Retry, timeout, cancel, resume, and dead-letter controls
- Separate worker deployment and heartbeat recovery
- Scheduler and webhook trigger management
- Malware scanning and file retention policy
- Metrics, tracing, active probes, alerting, and SLA/SLO reporting
- High availability, backup automation, and disaster recovery
- OIDC, SAML, and LDAP
- Published-app access policies suitable for broad SaaS use
