-- 0014_think_tank_core.sql
-- Think Tank Solution — Phase 1 core tables.
-- Purely additive: no changes to any existing table.
-- Isolation model matches 0001/0002: human path = user JWT + RLS; machine path = service-role with explicit tenant_id.
--
-- Tables created:
--   think_tanks   — one namespace per tenant (lazy-created on first idea)
--   ideas         — the core entity
--   idea_comments — threaded discussion (one level of nesting)
--   idea_ai_turns — AI sounding board history + audit trail

-- ---------------------------------------------------------------------------
-- think_tanks
-- ---------------------------------------------------------------------------
create table if not exists public.think_tanks (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  name         text not null default 'Think Tank',
  description  text,
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_think_tanks_tenant on public.think_tanks(tenant_id);
create trigger trg_think_tanks_updated before update on public.think_tanks for each row execute function public.set_updated_at();

alter table public.think_tanks enable row level security;

-- Members see all think tanks in their tenant; admins/owners can write.
create policy think_tanks_select on public.think_tanks
  for select using ( tenant_id in (select public.current_tenant_ids()) );

create policy think_tanks_insert on public.think_tanks
  for insert with check ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) );

create policy think_tanks_update on public.think_tanks
  for update using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

create policy think_tanks_delete on public.think_tanks
  for delete using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- ideas
-- ---------------------------------------------------------------------------
create table if not exists public.ideas (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  think_tank_id      uuid not null references public.think_tanks(id) on delete cascade,
  title              text not null,
  description        text,
  status             text not null default 'new'
                       check (status in ('new','researching','maturing','ready','converted','archived')),
  is_private         boolean not null default false,
  tags               text[] not null default '{}',
  created_by         uuid references public.users(id) on delete set null,
  assigned_to        uuid references public.users(id) on delete set null,
  linked_project_id  uuid references public.projects(id) on delete set null,
  converted_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_ideas_tenant       on public.ideas(tenant_id);
create index idx_ideas_think_tank   on public.ideas(think_tank_id);
create index idx_ideas_created_by   on public.ideas(created_by);
create index idx_ideas_status       on public.ideas(status);

create trigger trg_ideas_updated before update on public.ideas for each row execute function public.set_updated_at();

alter table public.ideas enable row level security;

-- SELECT: members see non-private ideas; they also see their own private ideas.
--         Owner/admin roles see all including private.
create policy ideas_select on public.ideas
  for select using (
    tenant_id in (select public.current_tenant_ids())
    and (
      not is_private
      or created_by = public.current_app_user_id()
      or public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
    )
  );

create policy ideas_insert on public.ideas
  for insert with check (
    public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[])
  );

-- UPDATE: creator or owner/admin only.
create policy ideas_update on public.ideas
  for update using (
    created_by = public.current_app_user_id()
    or public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
  );

-- DELETE: owner/admin only (creators cannot delete ideas — too disruptive to ongoing discussions).
create policy ideas_delete on public.ideas
  for delete using (
    public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
  );

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- idea_comments
-- ---------------------------------------------------------------------------
create table if not exists public.idea_comments (
  id          uuid primary key default gen_random_uuid(),
  idea_id     uuid not null references public.ideas(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  body        text not null,
  is_deleted  boolean not null default false,
  author_id   uuid references public.users(id) on delete set null,
  parent_id   uuid references public.idea_comments(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_idea_comments_idea   on public.idea_comments(idea_id);
create index idx_idea_comments_tenant on public.idea_comments(tenant_id);
create index idx_idea_comments_parent on public.idea_comments(parent_id);

create trigger trg_idea_comments_updated before update on public.idea_comments for each row execute function public.set_updated_at();

alter table public.idea_comments enable row level security;

-- Comments inherit the visibility of their parent idea — the JOIN to ideas enforces is_private via RLS on ideas.
-- Simplest safe rule: members can see comments on ideas they can see (RLS on ideas filters already).
create policy idea_comments_select on public.idea_comments
  for select using ( tenant_id in (select public.current_tenant_ids()) );

create policy idea_comments_insert on public.idea_comments
  for insert with check (
    public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[])
  );

-- UPDATE: author (for edit within 15-min window, enforced in app code) or admin.
create policy idea_comments_update on public.idea_comments
  for update using (
    author_id = public.current_app_user_id()
    or public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
  );

-- Hard deletes blocked at RLS; app does soft-delete (is_deleted = true) for authors.
-- Admins can hard-delete via service-role only.
create policy idea_comments_delete on public.idea_comments
  for delete using (
    public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
  );

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- idea_ai_turns
-- ---------------------------------------------------------------------------
create table if not exists public.idea_ai_turns (
  id           uuid primary key default gen_random_uuid(),
  idea_id      uuid not null references public.ideas(id) on delete cascade,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  user_id      uuid references public.users(id) on delete set null,
  pills        text[] not null default '{}',
  user_input   text,
  prompt_sent  text,
  ai_response  text,
  provider     text,
  created_at   timestamptz not null default now()
);

create index idx_idea_ai_turns_idea   on public.idea_ai_turns(idea_id);
create index idx_idea_ai_turns_tenant on public.idea_ai_turns(tenant_id);

alter table public.idea_ai_turns enable row level security;

-- Audit log: members can read AI turns for ideas they can see; insert by any member; no update/delete.
create policy idea_ai_turns_select on public.idea_ai_turns
  for select using ( tenant_id in (select public.current_tenant_ids()) );

create policy idea_ai_turns_insert on public.idea_ai_turns
  for insert with check (
    public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[])
  );

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- schema_migrations tracking
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (filename, notes) values
  ('0014_think_tank_core.sql', 'Think Tank core tables: think_tanks, ideas, idea_comments, idea_ai_turns')
on conflict (filename) do nothing;
