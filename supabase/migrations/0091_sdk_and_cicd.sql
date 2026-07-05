-- 0091_sdk_and_cicd.sql
-- FORGE-76: Error fingerprint + occurrence count for SDK dedup
-- FORGE-73: Deployments table for CI/CD tracking

-- Issues: fingerprint for dedup, occurrence count for grouped errors
alter table public.issues
  add column if not exists fingerprint      text,
  add column if not exists occurrence_count integer not null default 1,
  add column if not exists first_seen_at    timestamptz,
  add column if not exists last_seen_at     timestamptz;

-- Unique constraint: one open issue per fingerprint per project
-- Partial index (only open/in_progress issues participate in dedup)
create unique index if not exists issues_fingerprint_open
  on public.issues (tenant_id, project_id, fingerprint)
  where fingerprint is not null and status not in ('done', 'closed');

-- Deployments: track CI/CD deploys linked to git connections
create table if not exists public.deployments (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       uuid        not null references public.tenants(id) on delete cascade,
  connection_id   uuid        references public.git_connections(id) on delete set null,
  environment     text        not null default 'production',
  version         text        not null,            -- tag, SHA, or semver
  repo_full_name  text,
  deployed_by     text,                            -- GitHub actor login
  status          text        not null default 'success', -- success | failure | in_progress
  commit_sha      text,
  commit_url      text,
  deployed_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists deployments_tenant_at
  on public.deployments (tenant_id, deployed_at desc);

alter table public.deployments enable row level security;

-- Tenant members can read their own deployments
create policy "members_read_deployments"
  on public.deployments for select
  using (public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]));

-- Issues can be tagged with the deploy version that resolved them
alter table public.issues
  add column if not exists fixed_in_version text;

-- Helper: atomically increment occurrence_count and update last_seen_at.
-- Called by the V1 API when a duplicate fingerprint arrives.
create or replace function public.increment_issue_occurrence(issue_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.issues
  set
    occurrence_count = coalesce(occurrence_count, 1) + 1,
    last_seen_at     = now(),
    updated_at       = now()
  where id = issue_id;
$$;

insert into public.schema_migrations (filename)
  values ('0091_sdk_and_cicd.sql')
  on conflict (filename) do nothing;
