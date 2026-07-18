-- migrate:up

create table if not exists app_versions (
  id text primary key,
  workflow_id text not null,
  schema jsonb not null,
  prompt text not null default '',
  created_at timestamptz not null,
  status text not null check (status in ('draft', 'published'))
);

create index if not exists app_versions_workflow_created_idx
  on app_versions (workflow_id, created_at desc);

create table if not exists published_apps (
  slug text primary key,
  workflow_id text not null,
  version_id text not null references app_versions(id) on delete cascade,
  published_at timestamptz not null
);

create table if not exists workflow_runs (
  id text primary key,
  workflow_id text not null,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  inputs jsonb not null,
  outputs jsonb,
  steps jsonb,
  error text
);

create index if not exists workflow_runs_updated_idx
  on workflow_runs (updated_at desc);

create table if not exists workflow_canvases (
  workflow_id text primary key,
  graph jsonb not null,
  nodes jsonb not null,
  edges jsonb not null,
  updated_at timestamptz not null
);

create table if not exists auth_users (
  id text primary key,
  username text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null
);

create table if not exists auth_sessions (
  id text primary key,
  user_id text not null references auth_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null
);

create index if not exists auth_sessions_expires_idx
  on auth_sessions (expires_at);

create table if not exists model_registry (
  id text primary key,
  provider text not null,
  display_name text not null,
  endpoint text,
  capabilities jsonb not null,
  status text not null check (status in ('available', 'unavailable')),
  context_window integer,
  updated_at timestamptz not null
);

create table if not exists worker_pools (
  id text primary key,
  type text not null,
  label text not null,
  endpoint text,
  status text not null check (status in ('online', 'degraded', 'offline')),
  models jsonb not null,
  concurrency integer not null,
  updated_at timestamptz not null
);

-- migrate:down

-- Down migrations are intentionally not executed automatically. If a development
-- database must be reset, drop the CherryFlow database or remove these tables in
-- reverse dependency order after taking a backup.
