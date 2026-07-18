# Database migrations

CherryFlow uses ordered SQL migrations for PostgreSQL schema changes. Migration files live in:

```text
apps/api/migrations/
```

The API uses the existing `pg` dependency. No ORM is required.

## Commands

From the repository root:

```bash
pnpm db:migrate
pnpm db:status
pnpm db:check
```

- `db:migrate` applies every pending migration in version order.
- `db:status` prints applied and pending migrations.
- `db:check` exits with an error when any migration is pending and is suitable for deployment verification.

All commands use `DATABASE_URL`. When it is not set, the local development default is:

```text
postgres://cherryflow:cherryflow@127.0.0.1:5432/cherryflow
```

## API startup behavior

When PostgreSQL is configured, the API checks migrations before opening its listening socket.

```env
CHERRYFLOW_STORE=postgres
CHERRYFLOW_AUTO_MIGRATE=true
DATABASE_URL=postgresql://cherryflow:cherryflow@127.0.0.1:5432/cherryflow
```

`CHERRYFLOW_AUTO_MIGRATE=true` applies pending migrations during startup. This is convenient for a single-node installation and development.

For controlled production deployments, use:

```env
CHERRYFLOW_AUTO_MIGRATE=false
```

Then run `pnpm db:migrate` as a separate deployment step before restarting the API. When automatic migration is disabled, CherryFlow refuses to start if migrations are pending.

## Creating a migration

Use the next numeric version and a stable lowercase name:

```text
0002_add_workflows.sql
0003_add_task_inbox.sql
```

Each migration must include an up marker:

```sql
-- migrate:up

alter table workflow_runs
  add column if not exists correlation_id text;

create index if not exists workflow_runs_correlation_idx
  on workflow_runs (correlation_id);

-- migrate:down

-- Down SQL may be documented here, but CherryFlow does not execute destructive
-- rollback migrations automatically.
```

Never edit, rename, or remove a migration after it has been applied to a shared database. CherryFlow stores a SHA-256 checksum in `schema_migrations` and fails when an applied file changes.

## Safety model

The migration runner provides:

- ordered numeric versions;
- one transaction per migration;
- a PostgreSQL advisory lock so multiple API instances cannot migrate concurrently;
- checksums to detect edited migration history;
- startup failure when migration state is invalid;
- compatibility with databases already created by the previous `CREATE TABLE IF NOT EXISTS` bootstrap.

The baseline migration uses idempotent DDL. Existing CherryFlow PostgreSQL installations can therefore adopt migration tracking without deleting current data.

## Deployment sequence

Recommended production deployment:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm db:migrate
pnpm db:check
systemctl restart cherryflow-api.service
curl --fail http://127.0.0.1:4000/health
```

Back up PostgreSQL before migrations that transform or remove existing data. Destructive rollback is intentionally a manual, reviewed operation.
