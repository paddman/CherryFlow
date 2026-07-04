# CherryFlow

CherryFlow is an AI-first workflow and website builder. It creates a validated website from a workflow contract, publishes the result, and runs the workflow through a module graph.

## Available now

- Generate a website from Thai or English prompts
- Local, OpenAI-compatible, and OpenClaw planner modes
- Navbar, hero, statistics, feature cards, steps, FAQ, form, progress, results, callout, and footer sections
- Live preview, prompt refinement, draft versions, publishing, and rollback
- Public pages at `/apps/{slug}`
- Workflow graph validation and ordered module execution
- Per-node run events and final workflow outputs
- Local JSON persistence for the MVP

## Runtime

```text
Prompt + Workflow Contract
          ↓
Validated UI Schema
          ↓
Preview → Save → Publish Website
          ↓
Form → Workflow Graph → Modules → Output
```

## Requirements

- Node.js 24+
- pnpm 10+

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
- Published website: `http://localhost:3000/apps/{slug}`

The default provider is `local`. Add `website`, `landing`, `เว็บไซต์`, or `หน้าเว็บ` to the prompt to generate the full website template.

## Local model

```env
CHERRYFLOW_AI_PROVIDER=openai
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_API_KEY=local
OPENAI_MODEL=qwen3.5-35b-a3b
```

## API

```text
GET  /api/modules
GET  /api/workflows
GET  /api/workflows/:workflowId
GET  /api/workflows/:workflowId/graph
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

## Built-in modules

- `core.input`
- `file.inspect`
- `report.compose`
- `core.output`

This repository is a runnable MVP. Production deployment still needs PostgreSQL migrations, distributed workers, object storage, authentication, RBAC, quotas, rate limits, and secret management.
