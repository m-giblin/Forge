-- 0007_configurable_schema.sql — per-tenant configurable issue schema.
--
-- Decision D1 (scope doc): status/priority/type become plain TEXT governed by a
-- per-tenant config table + app validation, NOT DB enums/FKs. This avoids a
-- fragile data migration — Postgres preserves every existing value when the
-- enum is relaxed to text. Plus a 2-level category taxonomy.

-- ---------------------------------------------------------------------------
-- 1. Relax the enum columns to text (values preserved verbatim).
-- ---------------------------------------------------------------------------
alter table public.issues alter column status   drop default;
alter table public.issues alter column status   set data type text using status::text;
alter table public.issues alter column status   set default 'todo';

alter table public.issues alter column priority drop default;
alter table public.issues alter column priority set data type text using priority::text;
alter table public.issues alter column priority set default 'medium';

alter table public.issues alter column "type"   drop default;
alter table public.issues alter column "type"   set data type text using "type"::text;
alter table public.issues alter column "type"   set default 'bug';
-- NB: enum types issue_status / issue_priority / issue_type are now unused but
-- left in place (harmless) to keep this migration low-risk. issue_source stays.

-- ---------------------------------------------------------------------------
-- 2. Config tables
-- ---------------------------------------------------------------------------
create table public.tenant_field_options (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  field       text not null check (field in ('status', 'priority', 'type')),
  key         text not null,                      -- machine value stored on issues
  label       text not null,                      -- display
  color       text,
  position    int not null default 0,
  is_default  boolean not null default false,     -- chosen for new issues
  is_terminal boolean not null default false,     -- status only: "done"-like
  created_at  timestamptz not null default now(),
  unique (tenant_id, field, key)
);
create index idx_tfo_tenant on public.tenant_field_options(tenant_id, field);

create table public.tenant_categories (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  parent_id   uuid references public.tenant_categories(id) on delete cascade,
  name        text not null,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index idx_tcat_tenant on public.tenant_categories(tenant_id);

-- ---------------------------------------------------------------------------
-- 3. New issue columns (nullable / defaulted — no backfill needed)
-- ---------------------------------------------------------------------------
alter table public.issues add column category_id   uuid references public.tenant_categories(id) on delete set null;
alter table public.issues add column custom_values jsonb not null default '{}';  -- reserved for Phase 2

-- ---------------------------------------------------------------------------
-- 4. RLS — read by members, write by owner/admin (same model as other tables)
-- ---------------------------------------------------------------------------
alter table public.tenant_field_options enable row level security;
alter table public.tenant_categories    enable row level security;

create policy tfo_select on public.tenant_field_options
  for select using ( tenant_id in (select public.current_tenant_ids()) );
create policy tfo_write on public.tenant_field_options
  for all using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) )
  with check ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

create policy tcat_select on public.tenant_categories
  for select using ( tenant_id in (select public.current_tenant_ids()) );
create policy tcat_write on public.tenant_categories
  for all using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) )
  with check ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

-- ---------------------------------------------------------------------------
-- 5. Seed defaults — preserves today's behavior; tenants customize later.
-- ---------------------------------------------------------------------------
create or replace function public.seed_tenant_field_options(p_tenant uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.tenant_field_options (tenant_id, field, key, label, color, position, is_default, is_terminal) values
    (p_tenant,'status','backlog','Backlog','#9CA3AF',0,false,false),
    (p_tenant,'status','todo','To Do','#9CA3AF',1,true,false),
    (p_tenant,'status','in_progress','In Progress','#3B82F6',2,false,false),
    (p_tenant,'status','in_review','In Review','#F59E0B',3,false,false),
    (p_tenant,'status','done','Done','#10B981',4,false,true),
    (p_tenant,'priority','low','Low','#9CA3AF',0,false,false),
    (p_tenant,'priority','medium','Medium','#38BDF8',1,true,false),
    (p_tenant,'priority','high','High','#F59E0B',2,false,false),
    (p_tenant,'priority','urgent','Urgent','#EF4444',3,false,false),
    (p_tenant,'type','bug','Bug','#EF4444',0,true,false),
    (p_tenant,'type','task','Task','#38BDF8',1,false,false),
    (p_tenant,'type','feature','Feature','#8B5CF6',2,false,false)
  on conflict (tenant_id, field, key) do nothing;
end;
$$;

-- backfill every existing tenant
do $$
declare t record;
begin
  for t in select id from public.tenants loop
    perform public.seed_tenant_field_options(t.id);
  end loop;
end $$;

-- seed automatically for any future tenant (covers provision, seed scripts, etc.)
create or replace function public.trg_seed_tenant_options()
returns trigger language plpgsql as $$
begin
  perform public.seed_tenant_field_options(new.id);
  return new;
end;
$$;
create trigger trg_tenants_seed_options
  after insert on public.tenants
  for each row execute function public.trg_seed_tenant_options();
