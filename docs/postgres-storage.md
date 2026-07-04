# PostgreSQL persistence

CherryFlow can use either the original JSON file store or PostgreSQL without changing the API routes.

## Select the backend

JSON remains the default for local development:

```env
CHERRYFLOW_STORE_DRIVER=json
CHERRYFLOW_DATA_FILE=./data/cherryflow.json
```

Use PostgreSQL for durable workflow runs, app versions, and published applications:

```env
CHERRYFLOW_STORE_DRIVER=postgres
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
CHERRYFLOW_DATABASE_POOL_SIZE=10
CHERRYFLOW_DATABASE_CONNECT_TIMEOUT_SECONDS=10
CHERRYFLOW_DATABASE_IDLE_TIMEOUT_SECONDS=20
```

The repository Docker Compose file already includes a PostgreSQL service for local development:

```bash
docker compose up -d postgres
```

After PostgreSQL is healthy, configure the store driver and start CherryFlow normally.

## Schema initialization

The PostgreSQL backend creates the required tables and indexes on the first storage operation. The equivalent schema is also committed at:

```text
apps/api/migrations/001_initial.sql
```

The initial schema stores:

- UI schema versions
- published application pointers
- workflow run state
- workflow input and output JSON
- per-node execution steps
- failure information

Publishing an app version and updating its public slug happen in one PostgreSQL transaction.

## Health check

`GET /health` now verifies the selected storage backend.

Healthy PostgreSQL response:

```json
{
  "status": "ok",
  "service": "cherryflow-api",
  "storage": {
    "driver": "postgres",
    "status": "ok"
  }
}
```

When PostgreSQL is unavailable, the endpoint returns HTTP 503 and reports storage status as `error`.

## Compatibility

The public storage functions and API routes remain unchanged. Existing local installations continue using JSON unless `CHERRYFLOW_STORE_DRIVER=postgres` is explicitly configured.

This change does not automatically copy an existing JSON data file into PostgreSQL. A separate import command should be used before switching a deployment that already contains production data.

## Next production-core work

The persistence backend is the first Phase 1 foundation. Remaining production runtime work includes:

- a JSON-to-PostgreSQL import command
- Redis/BullMQ workers
- retry, timeout, cancel, and resume
- run log pagination and retention
- MinIO/S3 file storage
- readiness checks for workers, Redis, and object storage
