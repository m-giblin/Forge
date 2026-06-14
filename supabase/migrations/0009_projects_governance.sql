-- 0009_projects_governance.sql
-- Adds the governance/workflow layer the founder asked for:
--   #1  project intake dates (projects.start_date, projects.target_go_live)
--   #4  project-level team membership (project_members) — a SUBSET of tenant
--       members; controls which projects a non-admin sees on the landing page
--   #3  per-issue, APPEND-ONLY history visible to anyone working the ticket:
--         * issue_comments  — what people write ([username] is derived from author_id)
--         * issue_events    — system-stamped field changes (status moved, assignee set)
--
-- Same isolation model as 0001/0002:
--   * Human path  : user JWT + the RLS policies below.
--   * Machine path: service-role (BYPASSRLS) — repo layer injects tenant_id.
--
-- "Owner" of a project reuses the existing projects.lead_user_id column — no
-- redundant owner_user_id. The UI just labels it "Owner".
--
-- IMMUTABILITY: issue_comments and issue_events get SELECT + INSERT policies only.
-- With RLS on and no UPDATE/DELETE policy, those operations are denied for every
-- non-service-role caller. So users can append but can never edit or delete the
-- history. (service-role can, but no app code exposes that.)

-- ---------------------------------------------------------------------------
-- #1  Project intake dates
-- ---------------------------------------------------------------------------
alter table public.projects
  add column if not exists start_date     date,
  add column if not exists target_go_live date;

-- ---------------------------------------------------------------------------
-- #4  Project team (subset of tenant members)
-- ---------------------------------------------------------------------------
create table public.project_members (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id)  on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references public.users(id)    on delete cascade,
  role        text not null default 'member',  -- free-form within a project
  created_at  timestamptz not null default now(),
  unique (project_id, user_id)
);

create index idx_project_members_tenant  on public.project_members(tenant_id);
create index idx_project_members_project on public.project_members(project_id);
create index idx_project_members_user    on public.project_members(user_id);

alter table public.project_members enable row level security;

-- Read: anyone in the tenant (so an admin can manage, a member can see the roster).
create policy project_members_select on public.project_members
  for select using ( tenant_id in (select public.current_tenant_ids()) );

-- Write: owners/admins of the tenant only.
create policy project_members_insert on public.project_members
  for insert with check ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

create policy project_members_delete on public.project_members
  for delete using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

-- ---------------------------------------------------------------------------
-- #3  Issue comments (append-only)
-- ---------------------------------------------------------------------------
create table public.issue_comments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id)  on delete cascade,
  issue_id    uuid not null references public.issues(id)   on delete cascade,
  author_id   uuid references public.users(id) on delete set null,
  author_label text,                              -- email/name snapshot, durable across user deletes
  body        text not null,
  created_at  timestamptz not null default now()
);

create index idx_issue_comments_issue   on public.issue_comments(issue_id, created_at);
create index idx_issue_comments_tenant  on public.issue_comments(tenant_id);

alter table public.issue_comments enable row level security;

-- Read: anyone working in the tenant.
create policy issue_comments_select on public.issue_comments
  for select using ( tenant_id in (select public.current_tenant_ids()) );

-- Insert: any non-viewer member, and only as themselves.
create policy issue_comments_insert on public.issue_comments
  for insert with check (
    public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[])
    and author_id = public.current_app_user_id()
  );
-- NO update/delete policy -> comments are immutable once posted.

-- ---------------------------------------------------------------------------
-- #3  Issue events (append-only field-change log)
-- ---------------------------------------------------------------------------
create table public.issue_events (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  issue_id     uuid not null references public.issues(id)  on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_label  text,                             -- who, durable across user deletes
  field        text not null,                    -- 'status' | 'assignee' | 'priority' | ...
  old_value    text,
  new_value    text,
  created_at   timestamptz not null default now()
);

create index idx_issue_events_issue  on public.issue_events(issue_id, created_at);
create index idx_issue_events_tenant on public.issue_events(tenant_id);

alter table public.issue_events enable row level security;

-- Read: anyone working in the tenant.
create policy issue_events_select on public.issue_events
  for select using ( tenant_id in (select public.current_tenant_ids()) );

-- Insert: any non-viewer member, recorded as themselves (the edit they just made).
create policy issue_events_insert on public.issue_events
  for insert with check (
    public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[])
    and actor_user_id = public.current_app_user_id()
  );
-- NO update/delete policy -> events are immutable once recorded.
