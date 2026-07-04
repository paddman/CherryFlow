# CherryFlow

CherryFlow is a local-first AI workflow platform focused on Qwen models, OpenAI-compatible APIs, workflow automation, and reusable machine learning and deep learning modules.

## Architecture

```text
Local Qwen Model
      ↓
OpenAI-compatible API
      ↓
CherryFlow Provider Adapter
      ↓
Workflow Graph + Module Registry
      ↓
CPU / Document / Agent / GPU Workers
      ↓
Website / API / File / Database / Notification Output
```

## Product focus

- Run Qwen through vLLM, SGLang, Ollama, or another compatible inference server
- Connect models through an OpenAI-compatible API boundary
- Build deterministic, AI, agent, machine learning, and deep learning workflows
- Generate websites and internal applications from workflow contracts
- Route jobs to CPU, document, agent, or GPU worker pools
- Version, publish, monitor, and roll back workflow applications

## Available now

- Local deterministic planner
- OpenAI-compatible model provider
- Qwen-compatible endpoint configuration
- OpenClaw adapter
- Workflow graph engine and module registry
- Per-node run status
- Website generation from Thai or English prompts
- Live preview, refinement, versioning, publishing, and rollback
- Public applications at `/apps/{slug}`
- Builder interface at `/builder`

## Local Qwen configuration

```env
CHERRYFLOW_AI_PROVIDER=openai
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_API_KEY=local
OPENAI_MODEL=qwen3.5-35b-a3b
```

The provider name `openai` identifies the API protocol. The model can run on local infrastructure.

## Runtime

```text
Prompt / API / Form / Webhook
             ↓
        CherryFlow API
             ↓
 Workflow Graph and Module Runner
             ↓
 Deterministic / AI / Agent / ML-DL Modules
             ↓
 Text / Table / File / Database / Notification / Website
```

## Machine learning and deep learning direction

Planned module groups:

- Data loading, cleaning, feature preparation, and train/test split
- Classification, regression, clustering, anomaly detection, and forecasting
- OCR, document understanding, image classification, object detection, speech-to-text, and embeddings
- Training jobs, experiment tracking, model registry, deployment, and monitoring
- GPU worker routing, scheduling, quotas, and usage accounting

See [`docs/local-ai-stack.md`](docs/local-ai-stack.md) for the target architecture.

## Start development

Requirements:

- Node.js 24+
- pnpm 10+

```bash
nvm use
corepack enable
pnpm install
cp .env.example .env
pnpm dev
```

Open:

- Homepage: `http://localhost:3000`
- Builder: `http://localhost:3000/builder`
- API health: `http://localhost:4000/health`
- Published app: `http://localhost:3000/apps/{slug}`

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

## Roadmap

See [`docs/roadmap.md`](docs/roadmap.md). The current repository is a runnable MVP. PostgreSQL persistence, Redis workers, MinIO/S3 storage, authentication, visual workflow editing, ML/DL workers, and model operations are planned milestones.
