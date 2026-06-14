-- 0002_issues.sql — Issues table + RLS + realtime.
-- Same isolation model as 0001: human path enforced by RLS; machine path
-- (service-role) must inject tenant_id in code.

create type issue_status   as enum ('backlog', 'todo', 'in_progress', 'in_review', 'done');
create type issue_priority as enum ('low', 'medium', 'high', 'urgent');
create type issue_type     as enum ('bug', 'task', 'feature');
create type issue_source   as enum ('web', 'api', 'email');

create table public.issues (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  number       integer not null,                       -- per-project: WEB-1, WEB-2…
  title        text not null,
  description  text,
  status       issue_status   not null default 'todo',
  priority     issue_priority not null default 'medium',
  type         issue_type     not null default 'bug',
  assignee_id  uuid references public.users(id) on delete set null,
  reporter_id  uuid references public.users(id) on delete set null,
  labels       text[] not null default '{}',
  -- rich context captured from the integration API:
  environment  text,
  app_version  text,
  stack_trace  text,
  source       issue_source not null default 'web',
  -- ordering within a Kanban column (lower = higher):
  position     double precision not null default extract(epoch from now()),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, project_id, number)
);

create index idx_issues_tenant         on public.issues(tenant_id);
create index idx_issues_tenant_status  on public.issues(tenant_id, status);
create index idx_issues_project        on public.issues(project_id);
create index idx_issues_assignee       on public.issues(assignee_id);

create trigger trg_issues_updated before update on public.issues
  for each row execute function public.set_updated_at();

-- Per-project sequential issue number. Advisory lock serializes numbering per
-- project so concurrent inserts can't collide on the unique constraint.
create or replace function public.set_issue_number()
returns trigger language plpgsql as $$
begin
  if new.number is null or new.number = 0 then
    perform pg_advisory_xact_lock(hashtext(new.project_id::text));
    select coalesce(max(number), 0) + 1 into new.number
    from public.issues where project_id = new.project_id;
  end if;
  return new;
end;
$$;

create trigger trg_issues_number before insert on public.issues
  for each row execute function public.set_issue_number();

-- RLS
alter table public.issues enable row level security;

create policy issues_select on public.issues
  for select using ( tenant_id in (select public.current_tenant_ids()) );

create policy issues_insert on public.issues
  for insert with check ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) );

create policy issues_update on public.issues
  for update using ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) );

create policy issues_delete on public.issues
  for delete using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

-- Realtime: broadcast row changes (RLS still applies to subscribers via JWT).
alter publication supabase_realtime add table public.issues;
