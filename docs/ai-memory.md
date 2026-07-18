# CherryFlow AI Memory

CherryFlow AI Memory adds durable retrieval-augmented memory to the existing PostgreSQL production store. Memories are isolated by namespace, can be updated by a stable `sourceId`, and are searched by cosine similarity through pgvector.

## Architecture

```text
Web / API / LINE / Telegram / CherryAgent
                    |
           CherryFlow Memory API
                    |
       Embedding Provider Boundary
          |                    |
  local deterministic   OpenAI-compatible
       fallback          /v1/embeddings
          |                    |
          +------ 384-d vector-+
                    |
        PostgreSQL + pgvector HNSW
```

The local provider is a zero-configuration lexical embedding intended for development, CI, and fallback. Production semantic retrieval should use a dedicated embedding model through an OpenAI-compatible endpoint.

## Start the production dependencies

```bash
docker compose up -d postgres redis minio
cp .env.example .env
```

Set these values in `.env`:

```env
CHERRYFLOW_STORE=postgres
CHERRYFLOW_RUNNER=redis
DATABASE_URL=postgresql://cherryflow:cherryflow@127.0.0.1:5432/cherryflow

CHERRYFLOW_EMBEDDING_PROVIDER=openai
EMBEDDING_BASE_URL=http://127.0.0.1:8000/v1
EMBEDDING_API_KEY=local
EMBEDDING_MODEL=qwen3-embedding
```

Apply and verify migrations:

```bash
pnpm --filter @cherryflow/api db:migrate
pnpm --filter @cherryflow/api db:check
```

Start CherryFlow:

```bash
pnpm dev
curl http://127.0.0.1:4000/health
```

The health response reports `memory: "pgvector"` when PostgreSQL memory is enabled.

## Store or update memory

```bash
curl -X POST http://127.0.0.1:4000/api/memory/upsert \
  -H 'content-type: application/json' \
  -d '{
    "namespace": "operations",
    "sourceId": "runbook:nvme-timeout",
    "content": "When an NVMe/TCP path times out, verify VLAN 2238, MTU, route, and controller reconnect state before restarting services.",
    "metadata": {"type": "runbook", "site": "DC18"}
  }'
```

Sending the same namespace and `sourceId` updates the existing memory instead of creating a duplicate.

## Search memory

```bash
curl -X POST http://127.0.0.1:4000/api/memory/search \
  -H 'content-type: application/json' \
  -d '{
    "namespace": "operations",
    "query": "What should I check when NVMe storage disconnects?",
    "limit": 5,
    "minScore": 0.2
  }'
```

## Stats and deletion

```bash
curl http://127.0.0.1:4000/api/memory/stats
curl -X DELETE http://127.0.0.1:4000/api/memory/MEMORY_ID
```

## CherryAgent tools

The Agent tool registry exposes:

- `memory_search` — read-only semantic retrieval.
- `memory_remember` — durable write and update; requires explicit tool approval.

Example request:

```bash
curl -X POST http://127.0.0.1:4000/api/agent/run \
  -H 'content-type: application/json' \
  -d '{
    "prompt": "Remember that the finance close checklist must be completed by the fifth business day.",
    "allowedTools": ["memory_remember"],
    "approvedTools": ["memory_remember"]
  }'
```

## Operational notes

- Back up PostgreSQL before destructive schema or vector-index changes.
- Keep one embedding model per active memory collection. CherryFlow filters retrieval by embedding model to prevent incompatible comparisons.
- Changing the embedding model requires re-embedding existing content for that model.
- The HNSW index improves retrieval speed but consumes additional memory and build time.
- Treat memory metadata as application data; do not place secrets in it unless the database and access controls are designed for that classification.
