-- 0094: Recurring issue templates — auto-create issues on sprint start.
-- trigger: 'every_sprint' | 'every_n_sprints'
-- interval_sprints: only relevant for every_n_sprints (e.g. 2 = every other sprint)
-- sprint_count: sprints elapsed since last creation (used to pace interval)

create table if not exists public.recurring_issues (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  project_id       uuid not null references public.projects(id) on delete cascade,
  title            text not null,
  type             text not null default 'task',
  priority         text not null default 'medium',
  description      text,
  trigger          text not null default 'every_sprint'
                     check (trigger in ('every_sprint', 'every_n_sprints')),
  interval_sprints int  not null default 1,
  sprint_count     int  not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_recurring_issues_tenant
  on public.recurring_issues(tenant_id);

create index if not exists idx_recurring_issues_project
  on public.recurring_issues(project_id);

-- RLS: only workspace members can read; only admins/owners write.
alter table public.recurring_issues enable row level security;

create policy "recurring_issues_member_read" on public.recurring_issues
  for select using (
    tenant_id in (
      select tenant_id from public.memberships where user_id = auth.uid()
    )
  );

create policy "recurring_issues_admin_write" on public.recurring_issues
  for all using (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );
