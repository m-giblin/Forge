-- Migration 0104: Epics — the layer between a project and its sprints.
-- Hierarchy for Mind Maps: Idea -> Project -> Epic -> Sprint -> Issue.
-- Epic is a new first-class entity (chosen over overloading roadmap_phases,
-- which models cross-project timeline milestones, not per-project scope groups).

create table if not exists public.epics (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  title        text not null,
  description  text,
  status       text not null default 'planned' check (status in ('planned', 'active', 'done')),
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_epics_tenant_project on public.epics (tenant_id, project_id);

alter table public.epics enable row level security;

drop policy if exists epics_select on public.epics;
create policy epics_select on public.epics
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = epics.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

-- Writes go through the service-role client only (matches sprints' convention).

create trigger trg_epics_updated before update on public.epics
  for each row execute function public.set_updated_at();

-- Sprints now optionally roll up under an epic.
alter table public.sprints add column if not exists epic_id uuid references public.epics(id) on delete set null;
create index if not exists idx_sprints_epic on public.sprints (epic_id);

insert into public.schema_migrations (filename) values ('0104_epics.sql') on conflict do nothing;
