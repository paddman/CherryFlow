# CherryFlow

CherryFlow is an AI-first workflow and app builder. Describe the app you need, let an AI planner produce a safe UI Schema, preview the working form, run the workflow, save versions, and publish the result as a public URL.

## What works now

- Prompt-to-UI generation with three provider modes: `local`, `openai`, and `openclaw`
- Safe allowlisted UI Schema instead of arbitrary generated JavaScript
- Live React preview with form controls and file upload
- Workflow execution with queued/running/completed/failed states
- Polling and rendered text, table, and downloadable file outputs
- Save draft versions, publish by slug, list versions, and rollback
- Public runtime route at `/apps/{slug}`
- JSON-file persistence for the runnable MVP
- Node.js 24+, TypeScript, Next.js App Router, and a dependency-light Node API

## Architecture

```text
Prompt + Workflow Contract
          ↓
AI Planner (local / OpenAI-compatible / OpenClaw bridge)
          ↓
Normalize + Validate UI Schema
          ↓
React Live Preview
          ↓
Save Version → Publish Slug → Public App
          ↓
Submit Form → Workflow Run → Poll Status → Render Output
```

CherryFlow owns workflow state, schema validation, permissions, versioning, publishing, and audit-ready run records. AI providers only propose UI Schema.

## Requirements

- Node.js 24+
- pnpm 10+
- Docker Compose only when using the optional PostgreSQL, Redis, or MinIO services

## Start

```bash
nvm use
corepack enable
pnpm install
cp .env.example .env
pnpm dev
```

Open:

- Builder: `http://localhost:3000`
- API health: `http://localhost:4000/health`
- Published app example after publishing: `http://localhost:3000/apps/{slug}`

The default `CHERRYFLOW_AI_PROVIDER=local` requires no model and still creates varied, validated pages from Thai or English prompts.

## Connect a local model

```env
CHERRYFLOW_AI_PROVIDER=openai
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_API_KEY=local
OPENAI_MODEL=qwen3.5-35b-a3b
```

## Main endpoints

```text
GET  /api/workflows
GET  /api/workflows/:workflowId
POST /api/workflows/:workflowId/ui/generate
POST /api/workflows/:workflowId/ui/refine
POST /api/workflows/:workflowId/ui/validate
POST /api/workflows/:workflowId/ui/save
GET  /api/workflows/:workflowId/ui/versions
POST /api/workflows/:workflowId/ui/publish
POST /api/workflows/:workflowId/ui/rollback
POST /api/workflows/:workflowId/runs
GET  /api/runs/:runId
GET  /api/apps/:slug
POST /api/apps/:slug/run
```

## Scope

This is a complete runnable MVP for auto-generating and publishing workflow frontends. Production multi-tenancy, SSO/RBAC, distributed queues, object storage, database migrations, rate limiting, and isolated agent sandboxes remain deployment hardening work.

See `docs/architecture.md` and `docs/ai-providers.md`.
