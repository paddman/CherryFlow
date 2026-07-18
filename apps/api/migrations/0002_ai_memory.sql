-- migrate:up

create extension if not exists vector;

create table if not exists ai_memories (
  id text primary key,
  namespace text not null default 'default',
  source_id text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(384) not null,
  embedding_provider text not null,
  embedding_model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_memories_namespace_source_uidx
  on ai_memories (namespace, source_id)
  where source_id is not null;

create index if not exists ai_memories_namespace_updated_idx
  on ai_memories (namespace, updated_at desc);

create index if not exists ai_memories_embedding_hnsw_idx
  on ai_memories using hnsw (embedding vector_cosine_ops);

-- migrate:down

drop table if exists ai_memories;
