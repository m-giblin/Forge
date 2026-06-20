-- Saved views: named filter+sort+groupBy presets per project.
-- user_id=null means team-shared view; user_id=current user means personal view.

create table if not exists public.issue_saved_views (
  id          uuid        not null default gen_random_uuid() primary key,
  tenant_id   uuid        not null references public.tenants(id) on delete cascade,
  project_id  uuid        references public.projects(id) on delete cascade,
  user_id     uuid        references public.users(id) on delete cascade,
  name        text        not null,
  filters     jsonb       not null default '{}',
  is_shared   boolean     not null default false,
  is_default  boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists issue_saved_views_tenant_idx   on public.issue_saved_views(tenant_id);
create index if not exists issue_saved_views_project_idx  on public.issue_saved_views(project_id);
create index if not exists issue_saved_views_user_idx     on public.issue_saved_views(user_id);

alter table public.issue_saved_views enable row level security;

-- Tenant members can read shared views and their own personal views
create policy "read saved views"
  on public.issue_saved_views for select
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = issue_saved_views.tenant_id
        and m.user_id   = auth.uid()
    )
    and (is_shared = true or user_id = auth.uid())
  );

-- Users can insert their own views
create policy "insert own saved views"
  on public.issue_saved_views for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.tenant_id = issue_saved_views.tenant_id
        and m.user_id   = auth.uid()
    )
  );

-- Users can update/delete their own views; owners/admins can manage shared views
create policy "update own saved views"
  on public.issue_saved_views for update
  using (user_id = auth.uid());

create policy "delete own saved views"
  on public.issue_saved_views for delete
  using (user_id = auth.uid());

insert into public.schema_migrations (filename) values ('0040_issue_saved_views.sql') on conflict do nothing;
