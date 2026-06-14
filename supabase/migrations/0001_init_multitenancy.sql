-- 0001_init_multitenancy.sql
-- Forge — multi-tenant foundation: tenants, users, memberships, projects + RLS.
--
-- Isolation model (see Architecture §5):
--   * Human path  : browser -> user JWT. RLS policies below enforce isolation
--                   natively using auth.uid(). Nothing extra in app code.
--   * Machine path: API key -> service-role client. service_role has BYPASSRLS,
--                   so these policies DO NOT apply to it. The repository layer
--                   MUST inject tenant_id on every service-role query. That is
--                   the one place isolation lives in code, not the database.
--
-- To avoid recursive RLS evaluation (a policy on memberships that itself queries
-- memberships), tenant lookups go through SECURITY DEFINER helper functions that
-- run with the definer's rights and bypass RLS internally.

-- ---------------------------------------------------------------------------
-- Enums & helpers
-- ---------------------------------------------------------------------------
create type membership_role as enum ('owner', 'admin', 'member', 'viewer');

-- Generic updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  status      text not null default 'active' check (status in ('active', 'suspended')),
  plan        text not null default 'free',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Application users. auth_id links to Supabase Auth (auth.users.id).
create table public.users (
  id          uuid primary key default gen_random_uuid(),
  auth_id     uuid unique references auth.users(id) on delete set null,
  email       text not null,
  name        text,
  status      text not null default 'active' check (status in ('active', 'deactivated')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- A user can belong to many tenants, each with a role.
create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  role        membership_role not null default 'member',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  key           text not null,                       -- e.g. "WEB"
  name          text not null,
  lead_user_id  uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, key)
);

-- Indexes on tenant_id (every tenant-scoped read filters on it)
create index idx_memberships_tenant on public.memberships(tenant_id);
create index idx_memberships_user   on public.memberships(user_id);
create index idx_projects_tenant    on public.projects(tenant_id);

-- updated_at triggers
create trigger trg_tenants_updated     before update on public.tenants     for each row execute function public.set_updated_at();
create trigger trg_users_updated       before update on public.users       for each row execute function public.set_updated_at();
create trigger trg_memberships_updated before update on public.memberships for each row execute function public.set_updated_at();
create trigger trg_projects_updated    before update on public.projects    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helper functions (SECURITY DEFINER -> bypass RLS internally, no recursion)
-- ---------------------------------------------------------------------------

-- The application user id for the current JWT, or null for service-role/anon.
create or replace function public.current_app_user_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.users where auth_id = auth.uid()
$$;

-- The set of tenant ids the current JWT user belongs to.
create or replace function public.current_tenant_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select m.tenant_id
  from public.memberships m
  join public.users u on u.id = m.user_id
  where u.auth_id = auth.uid()
$$;

-- Does the current JWT user hold one of p_roles in p_tenant?
create or replace function public.has_tenant_role(p_tenant uuid, p_roles membership_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.memberships m
    join public.users u on u.id = m.user_id
    where u.auth_id = auth.uid()
      and m.tenant_id = p_tenant
      and m.role = any (p_roles)
  )
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.tenants     enable row level security;
alter table public.users       enable row level security;
alter table public.memberships enable row level security;
alter table public.projects    enable row level security;

-- TENANTS ------------------------------------------------------------------
-- Read: members of the tenant. Write: owners/admins only.
create policy tenants_select on public.tenants
  for select using ( id in (select public.current_tenant_ids()) );

create policy tenants_update on public.tenants
  for update using ( public.has_tenant_role(id, array['owner','admin']::membership_role[]) );

-- USERS --------------------------------------------------------------------
-- Read: yourself, plus anyone who shares a tenant with you (for assignees).
-- Update: only your own row.
create policy users_select_self on public.users
  for select using ( auth_id = auth.uid() );

create policy users_select_shared_tenant on public.users
  for select using (
    id in (
      select m.user_id from public.memberships m
      where m.tenant_id in (select public.current_tenant_ids())
    )
  );

create policy users_update_self on public.users
  for update using ( auth_id = auth.uid() );

-- MEMBERSHIPS --------------------------------------------------------------
-- Read: memberships within your tenants. Write: owners/admins of that tenant.
create policy memberships_select on public.memberships
  for select using ( tenant_id in (select public.current_tenant_ids()) );

create policy memberships_insert on public.memberships
  for insert with check ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

create policy memberships_update on public.memberships
  for update using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

create policy memberships_delete on public.memberships
  for delete using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

-- PROJECTS -----------------------------------------------------------------
-- Read: members of the tenant. Write: owner/admin/member (not viewer).
create policy projects_select on public.projects
  for select using ( tenant_id in (select public.current_tenant_ids()) );

create policy projects_insert on public.projects
  for insert with check ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) );

create policy projects_update on public.projects
  for update using ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) );

create policy projects_delete on public.projects
  for delete using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );
