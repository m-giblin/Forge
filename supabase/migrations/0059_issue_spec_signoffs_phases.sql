-- Migration 0059: Issue spec, issue sign-offs, roadmap phases
-- Covers 4 competitive gap features:
--   1. issues.spec_md  — per-issue embedded PRD/spec (plain column, no new table)
--   2. issue_signoffs  — formal sign-off records per issue
--   3. roadmap_phases  — phase/milestone layer above projects on the roadmap
--   4. projects.phase_id FK to roadmap_phases

-- ─── 1. Per-issue embedded spec ───────────────────────────────────────────────
alter table public.issues
  add column if not exists spec_md text default null;

-- ─── 2. Issue sign-offs ───────────────────────────────────────────────────────
create table if not exists public.issue_signoffs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  issue_id    uuid not null references public.issues(id) on delete cascade,
  role_label  text not null,         -- e.g. "Design", "Engineering", "Product"
  signed_by   uuid references public.users(id) on delete set null,
  signed_at   timestamptz,
  created_at  timestamptz not null default now(),
  unique (issue_id, role_label)
);

create index if not exists idx_issue_signoffs_issue  on public.issue_signoffs(issue_id);
create index if not exists idx_issue_signoffs_tenant on public.issue_signoffs(tenant_id);

alter table public.issue_signoffs enable row level security;

-- Drop first in case migration was partially applied
drop policy if exists issue_signoffs_select on public.issue_signoffs;
drop policy if exists issue_signoffs_insert on public.issue_signoffs;
drop policy if exists issue_signoffs_update on public.issue_signoffs;
drop policy if exists issue_signoffs_delete on public.issue_signoffs;

-- Members can read; owner/admin can insert/delete; any member can sign (update signed_by)
create policy issue_signoffs_select on public.issue_signoffs
  for select using (
    exists (select 1 from public.memberships m
            where m.tenant_id = issue_signoffs.tenant_id and m.user_id = auth.uid())
  );

create policy issue_signoffs_insert on public.issue_signoffs
  for insert with check (
    exists (select 1 from public.memberships m
            where m.tenant_id = issue_signoffs.tenant_id
              and m.user_id = auth.uid()
              and m.role in ('owner', 'admin'))
  );

create policy issue_signoffs_update on public.issue_signoffs
  for update using (
    exists (select 1 from public.memberships m
            where m.tenant_id = issue_signoffs.tenant_id and m.user_id = auth.uid())
  );

create policy issue_signoffs_delete on public.issue_signoffs
  for delete using (
    exists (select 1 from public.memberships m
            where m.tenant_id = issue_signoffs.tenant_id
              and m.user_id = auth.uid()
              and m.role in ('owner', 'admin'))
  );

-- ─── 3. Roadmap phases ────────────────────────────────────────────────────────
create table if not exists public.roadmap_phases (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  description text,
  color       text not null default 'indigo',
  start_date  date,
  end_date    date,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_roadmap_phases_tenant on public.roadmap_phases(tenant_id);

alter table public.roadmap_phases enable row level security;

drop policy if exists roadmap_phases_select on public.roadmap_phases;
drop policy if exists roadmap_phases_write on public.roadmap_phases;

create policy roadmap_phases_select on public.roadmap_phases
  for select using (
    exists (select 1 from public.memberships m
            where m.tenant_id = roadmap_phases.tenant_id and m.user_id = auth.uid())
  );

create policy roadmap_phases_write on public.roadmap_phases
  for all using (
    exists (select 1 from public.memberships m
            where m.tenant_id = roadmap_phases.tenant_id
              and m.user_id = auth.uid()
              and m.role in ('owner', 'admin'))
  );

-- ─── 4. Link projects → phases ───────────────────────────────────────────────
alter table public.projects
  add column if not exists phase_id uuid references public.roadmap_phases(id) on delete set null;

create index if not exists idx_projects_phase on public.projects(phase_id);

-- ─── housekeeping ─────────────────────────────────────────────────────────────
insert into public.schema_migrations (filename)
  values ('0059_issue_spec_signoffs_phases.sql')
  on conflict (filename) do nothing;
