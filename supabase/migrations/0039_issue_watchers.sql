-- Issue watchers: users who subscribe to notifications on an issue.
-- Auto-populated when a user creates, is assigned to, comments on, or is @mentioned on an issue.

create table if not exists public.issue_watchers (
  issue_id  uuid not null references public.issues(id) on delete cascade,
  user_id   uuid not null references public.users(id)  on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (issue_id, user_id)
);

create index if not exists issue_watchers_issue_id_idx on public.issue_watchers(issue_id);
create index if not exists issue_watchers_user_id_idx  on public.issue_watchers(user_id);

-- RLS: tenant members can read; writes via service-role only (auto-watch logic in app layer)
alter table public.issue_watchers enable row level security;

create policy "tenant members can view watchers"
  on public.issue_watchers for select
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = issue_watchers.tenant_id
        and m.user_id   = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies — all writes go through service-role in app layer.

insert into public.schema_migrations (filename) values ('0039_issue_watchers.sql') on conflict do nothing;
