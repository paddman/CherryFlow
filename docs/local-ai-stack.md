# CherryFlow Local AI Stack

CherryFlow is a local-first AI workflow platform. The primary design is to run Qwen inside the customer environment, expose it through an OpenAI-compatible API, and connect it to reusable workflow, machine learning, and deep learning modules.

## Core layers

1. Local Qwen model serving
2. OpenAI-compatible API access
3. Workflow and agent orchestration
4. Machine learning and deep learning modules

## Local Qwen runtime

```text
Qwen model
   ↓
vLLM / SGLang / Ollama / compatible server
   ↓
OpenAI-compatible API
   ↓
CherryFlow provider adapter
```

Example configuration:

```env
CHERRYFLOW_AI_PROVIDER=openai
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_API_KEY=local
OPENAI_MODEL=qwen3.5-35b-a3b
```

The `openai` provider name identifies the API protocol. It does not require an external hosted model.

## API-first boundary

Workflow nodes and websites call CherryFlow API. They do not connect directly to the model server.

```text
Website / Application / Webhook
              ↓
         CherryFlow API
              ↓
       Workflow Graph
              ↓
     AI Provider Adapter
              ↓
 Local OpenAI-compatible Endpoint
```

This layer is responsible for model configuration, structured output validation, routing, quotas, and run metadata.

## Workflow and agent modules

Deterministic modules include HTTP requests, database queries, file extraction, transformations, conditions, document generation, approval, and notifications.

AI modules include LLM prompts, structured extraction, classification, summarization, tool-calling agents, OpenClaw integration, embeddings, and retrieval.

AI proposes output. CherryFlow validates and executes the workflow state.

## Machine learning and deep learning direction

ML and deep learning capabilities are implemented as modules instead of being embedded inside the workflow engine.

Planned module groups:

- Data loading, cleaning, normalization, encoding, and train/test split
- Classification, regression, clustering, anomaly detection, and forecasting
- OCR, document understanding, image classification, object detection, speech-to-text, and embeddings
- Training jobs, experiment tracking, model registry, deployment status, and drift monitoring

## Target worker architecture

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

Each module declares its resource requirement so jobs can be routed to the correct worker pool.

## Current status

Available now:

- Local deterministic planner
- OpenAI-compatible provider adapter
- Qwen-compatible endpoint configuration
- OpenClaw adapter
- Workflow graph engine and module registry
- Website generation, publishing, and per-node status

Planned next:

- PostgreSQL persistence
- Redis workers
- MinIO/S3 storage
- Visual workflow canvas
- LLM and agent nodes
- Data preparation and ML/DL modules
- Dataset, experiment, and model registry
- GPU scheduling and usage accounting

## Design rule

CherryFlow remains model-independent at the API boundary while being optimized for private local Qwen deployments as the primary product experience.
