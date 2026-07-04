CREATE TABLE IF NOT EXISTS cherryflow_app_versions (
  id uuid PRIMARY KEY,
  workflow_id text NOT NULL,
  schema jsonb NOT NULL,
  prompt text NOT NULL,
  created_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'published'))
);

CREATE INDEX IF NOT EXISTS cherryflow_app_versions_workflow_created_idx
  ON cherryflow_app_versions (workflow_id, created_at DESC);

CREATE TABLE IF NOT EXISTS cherryflow_published_apps (
  slug text PRIMARY KEY,
  workflow_id text NOT NULL,
  version_id uuid NOT NULL REFERENCES cherryflow_app_versions(id) ON DELETE RESTRICT,
  published_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS cherryflow_workflow_runs (
  id uuid PRIMARY KEY,
  workflow_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  inputs jsonb NOT NULL,
  outputs jsonb,
  steps jsonb,
  error text
);

CREATE INDEX IF NOT EXISTS cherryflow_workflow_runs_workflow_created_idx
  ON cherryflow_workflow_runs (workflow_id, created_at DESC);

CREATE INDEX IF NOT EXISTS cherryflow_workflow_runs_status_updated_idx
  ON cherryflow_workflow_runs (status, updated_at);
