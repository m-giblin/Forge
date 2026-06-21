-- Migration 0053: Project roadmap ordering and dependencies
-- Adds two things:
--   1. `roadmap_position` on projects — manual x-position (0.0-1.0) for the gantt bar,
--      so PM drag positions persist across sessions.
--   2. `project_dependencies` table — links project A "depends on" project B,
--      used by the roadmap cascade-confirm feature.

-- Persist drag positions for the roadmap gantt
alter table public.projects
  add column if not exists roadmap_position  numeric(4,3) default null,
  add column if not exists roadmap_width     numeric(4,3) default null;

-- Project-to-project dependency links (for cascade moves)
create table if not exists public.project_dependencies (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  project_id     uuid not null references public.projects(id) on delete cascade,
  depends_on_id  uuid not null references public.projects(id) on delete cascade,
  created_by     uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (project_id, depends_on_id)
);

create index if not exists idx_project_deps_project   on public.project_dependencies(project_id);
create index if not exists idx_project_deps_depends   on public.project_dependencies(depends_on_id);
create index if not exists idx_project_deps_tenant    on public.project_dependencies(tenant_id);

alter table public.project_dependencies enable row level security;

-- Owners/admins can manage dependencies; members can read
create policy project_deps_select on public.project_dependencies
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = project_dependencies.tenant_id
        and m.user_id = auth.uid()
    )
  );

create policy project_deps_insert on public.project_dependencies
  for insert with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = project_dependencies.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

create policy project_deps_delete on public.project_dependencies
  for delete using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = project_dependencies.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

insert into public.schema_migrations (filename)
  values ('0053_roadmap_dependencies.sql')
  on conflict (filename) do nothing;
