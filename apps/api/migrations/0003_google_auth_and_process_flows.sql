-- migrate:up

alter table auth_users add column if not exists email text;
alter table auth_users add column if not exists display_name text;
alter table auth_users add column if not exists avatar_url text;
alter table auth_users add column if not exists google_sub text;
alter table auth_users add column if not exists auth_provider text not null default 'local';

create unique index if not exists auth_users_google_sub_uidx
  on auth_users (google_sub)
  where google_sub is not null;

create table if not exists process_flows (
  id text primary key,
  owner_id text not null references auth_users(id) on delete cascade,
  title text not null,
  payload jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists process_flows_owner_updated_idx
  on process_flows (owner_id, updated_at desc);

-- migrate:down

drop table if exists process_flows;
drop index if exists auth_users_google_sub_uidx;
alter table auth_users drop column if exists auth_provider;
alter table auth_users drop column if exists google_sub;
alter table auth_users drop column if exists avatar_url;
alter table auth_users drop column if exists display_name;
alter table auth_users drop column if exists email;
