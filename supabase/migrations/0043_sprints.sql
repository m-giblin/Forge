-- Sprints: per-project sprint/cycle management.
create table public.sprints (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null,
  goal        text,
  status      text not null default 'planned' check (status in ('planned', 'active', 'completed')),
  start_date  date,
  end_date    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index sprints_tenant_project on public.sprints (tenant_id, project_id);

-- Issues: add sprint reference (null = backlog)
alter table public.issues add column if not exists sprint_id uuid references public.sprints(id) on delete set null;
create index issues_sprint_id on public.issues (sprint_id);

-- RLS for sprints: tenant members can read; admins/owners write via service-role
alter table public.sprints enable row level security;

create policy sprints_select on public.sprints
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = sprints.tenant_id
        and m.user_id = (select id from public.users where auth_id = auth.uid())
    )
  );

-- Writes go through service-role only (no user-JWT write policies)

create trigger trg_sprints_updated before update on public.sprints
  for each row execute function public.set_updated_at();

insert into public.schema_migrations (filename) values ('0043_sprints.sql') on conflict do nothing;
