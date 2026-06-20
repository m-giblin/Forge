-- 0028_git_integration.sql
-- Phase 0 of Git integration: connect a tenant's GitHub repos to Forge so code
-- activity (commits, PRs, reviews) can be ingested and linked to issues. This
-- migration creates ONLY the schema — the webhook endpoint, GitHub App wiring,
-- and UI land in app code. Building the tables now avoids future migration churn.
--
-- Isolation model (same as 0001/0009):
--   * Human path  : user JWT + the RLS policies below.
--   * Machine path: the GitHub webhook is unauthenticated by a Forge user — it
--     runs service-role (BYPASSRLS) and the repo layer injects tenant_id, which
--     it resolves from the GitHub installation_id. RLS is the backstop.
--
-- SECRETS: git_connections stores the per-installation webhook secret and the
-- App installation token AES-256-GCM encrypted (FORGE_AI_KEY_SECRET, the same
-- key the AI-key store uses), in ciphertext/nonce/tag columns. There is NO
-- SELECT RLS policy granting clients those columns — secret reads happen only in
-- server code via the service-role client, exactly like tenant_ai_keys.
--
-- code_events and issue_code_links are APPEND-MOSTLY history: SELECT + INSERT
-- policies for the tenant; updates/deletes go through service-role only.

-- ---------------------------------------------------------------------------
-- git_connections — one row per installed GitHub App installation, per tenant
-- ---------------------------------------------------------------------------
create table if not exists public.git_connections (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  provider         text not null default 'github' check (provider in ('github')),
  installation_id  text not null,                  -- GitHub App installation id
  account_login    text,                           -- org/user the app is installed on
  -- Per-installation webhook secret (AES-256-GCM, base64), used to verify the
  -- X-Hub-Signature-256 HMAC on inbound webhooks.
  webhook_secret_enc   text,
  webhook_secret_nonce text,
  webhook_secret_tag   text,
  status           text not null default 'active' check (status in ('active', 'revoked')),
  created_by        uuid references public.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (provider, installation_id)
);

create index if not exists idx_git_connections_tenant on public.git_connections(tenant_id);

alter table public.git_connections enable row level security;

-- Read: anyone in the tenant may see that a connection exists + its status.
-- (Secret columns are never selected by client code — server-only, service-role.)
create policy git_connections_select on public.git_connections
  for select using ( tenant_id in (select public.current_tenant_ids()) );

-- Write: owners/admins only (connect/disconnect is an admin action).
create policy git_connections_insert on public.git_connections
  for insert with check ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

create policy git_connections_update on public.git_connections
  for update using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

create policy git_connections_delete on public.git_connections
  for delete using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

create trigger git_connections_updated_at
  before update on public.git_connections
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- git_repo_links — which repo routes events to which Forge project
-- ---------------------------------------------------------------------------
create table if not exists public.git_repo_links (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  connection_id   uuid not null references public.git_connections(id) on delete cascade,
  repo_full_name  text not null,                   -- e.g. "travli/web"
  project_id      uuid references public.projects(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (tenant_id, repo_full_name)
);

create index if not exists idx_git_repo_links_tenant     on public.git_repo_links(tenant_id);
create index if not exists idx_git_repo_links_connection on public.git_repo_links(connection_id);

alter table public.git_repo_links enable row level security;

create policy git_repo_links_select on public.git_repo_links
  for select using ( tenant_id in (select public.current_tenant_ids()) );

create policy git_repo_links_insert on public.git_repo_links
  for insert with check ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

create policy git_repo_links_update on public.git_repo_links
  for update using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

create policy git_repo_links_delete on public.git_repo_links
  for delete using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

-- ---------------------------------------------------------------------------
-- code_events — raw, append-only log of ingested GitHub events
-- ---------------------------------------------------------------------------
create table if not exists public.code_events (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  connection_id   uuid not null references public.git_connections(id) on delete cascade,
  repo_full_name  text not null,
  -- kind drives metric computation downstream (Phase 1+):
  --   commit | pr_opened | pr_review | pr_merged | pr_closed
  --   deploy_succeeded | deploy_failed   (Phase 2)
  kind            text not null,
  external_id     text,                            -- GitHub delivery/node id for dedupe
  pr_number       integer,
  sha             text,
  branch          text,
  actor_login     text,
  occurred_at     timestamptz not null,            -- when it happened on GitHub
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  -- Idempotency: GitHub retries deliveries; the same (connection, kind, external_id)
  -- must never double-insert.
  unique (connection_id, kind, external_id)
);

create index if not exists idx_code_events_tenant    on public.code_events(tenant_id);
create index if not exists idx_code_events_repo_pr   on public.code_events(tenant_id, repo_full_name, pr_number);
create index if not exists idx_code_events_occurred  on public.code_events(tenant_id, occurred_at);

alter table public.code_events enable row level security;

-- Read: tenant members. Insert: tenant members (webhook uses service-role anyway).
-- No update/delete policy → immutable to non-service-role callers.
create policy code_events_select on public.code_events
  for select using ( tenant_id in (select public.current_tenant_ids()) );

create policy code_events_insert on public.code_events
  for insert with check ( tenant_id in (select public.current_tenant_ids()) );

-- ---------------------------------------------------------------------------
-- issue_code_links — the bridge between an issue and a PR
-- ---------------------------------------------------------------------------
create table if not exists public.issue_code_links (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  issue_id        uuid not null references public.issues(id) on delete cascade,
  connection_id   uuid not null references public.git_connections(id) on delete cascade,
  repo_full_name  text not null,
  pr_number       integer not null,
  -- how the link was discovered: branch name, PR title, or PR body ref.
  link_kind       text not null default 'ref' check (link_kind in ('branch', 'title', 'body', 'ref')),
  pr_state        text,                            -- open | merged | closed (latest known)
  pr_title        text,
  pr_url          text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, issue_id, repo_full_name, pr_number)
);

create index if not exists idx_issue_code_links_tenant on public.issue_code_links(tenant_id);
create index if not exists idx_issue_code_links_issue  on public.issue_code_links(issue_id);

alter table public.issue_code_links enable row level security;

create policy issue_code_links_select on public.issue_code_links
  for select using ( tenant_id in (select public.current_tenant_ids()) );

create policy issue_code_links_insert on public.issue_code_links
  for insert with check ( tenant_id in (select public.current_tenant_ids()) );

create policy issue_code_links_update on public.issue_code_links
  for update using ( tenant_id in (select public.current_tenant_ids()) );

create trigger issue_code_links_updated_at
  before update on public.issue_code_links
  for each row execute procedure public.set_updated_at();

insert into public.schema_migrations (filename)
values ('0028_git_integration.sql')
on conflict do nothing;
