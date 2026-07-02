# CherryFlow

CherryFlow is an AI-first workflow and app builder. Users assemble reusable modules, upload or enter data, run deterministic or agent-based steps, and publish a generated frontend for each workflow.

## Included in this scaffold

- TypeScript monorepo with pnpm workspaces
- Minimal CherryFlow API
- AI App Builder screen
- Shared Workflow Contract and UI Schema types
- UI Schema binding validator
- OpenClaw client plugin boundary
- PostgreSQL, Redis, and MinIO development services
- Architecture and security notes

## Architecture

```text
Workflow Definition
        ↓
Input / Output Contract
        ↓
Deterministic Nodes + Agent Nodes
        ↓
Validated UI Schema
        ↓
CherryFlow Renderer
        ↓
Preview / Approve / Publish
```

OpenClaw is integrated as an optional agent runtime. CherryFlow remains responsible for workflow state, permissions, audit logs, publishing, and rollback.

## Requirements

- Node.js 24+
- pnpm 10+
- Docker Compose for PostgreSQL, Redis, and MinIO

## Start development

```bash
nvm use
corepack enable
pnpm install
cp .env.example .env
docker compose up -d
pnpm dev
```

Open:

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/health`

## Current demo

The web screen sends a prompt to:

```text
POST /api/workflows/report-generator/ui/generate
```

The API creates a UI Schema, validates every input/output binding against the workflow contract, and returns the generated schema for preview.

## Next milestones

1. Persist workflows, UI versions, and runs in PostgreSQL.
2. Add Redis-backed workers and execution events.
3. Add real LLM provider adapters.
4. Render UI Schema as interactive forms and outputs.
5. Add OpenClaw gateway authentication and streaming run status.
6. Add approval, publishing, version history, and rollback.

See [docs/architecture.md](docs/architecture.md) and [Issue #1](https://github.com/paddman/CherryFlow/issues/1).
