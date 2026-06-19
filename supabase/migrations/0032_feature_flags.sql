-- 0032_feature_flags.sql
-- Feature flags for staged go-to-market: ship the bug tracker (Issues + Board)
-- now, gate the project-management layer (Think Tank, dashboards, project portal)
-- behind flags that the super-admin flips on as each firms up.
--
-- Model: a global default per flag + optional per-tenant override.
--   resolved(tenant, key) = override.enabled if an override row exists,
--                           else feature_flags.enabled (global default).
-- Both tables are service-role only (no RLS policies), like platform_settings —
-- all reads/writes go through server code (gating helper + super-admin actions).

create table if not exists public.feature_flags (
  key         text primary key,
  label       text not null,
  description text,
  enabled     boolean not null default false,   -- global default
  updated_at  timestamptz not null default now()
);

alter table public.feature_flags enable row level security;
-- No policies — service-role only.

create table if not exists public.tenant_feature_overrides (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  key        text not null references public.feature_flags(key) on delete cascade,
  enabled    boolean not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

alter table public.tenant_feature_overrides enable row level security;
-- No policies — service-role only.

create trigger feature_flags_updated_at
  before update on public.feature_flags
  for each row execute procedure public.set_updated_at();

create trigger tenant_feature_overrides_updated_at
  before update on public.tenant_feature_overrides
  for each row execute procedure public.set_updated_at();

-- Seed the project-management flags, globally OFF (new tenants = board-only).
insert into public.feature_flags (key, label, description, enabled) values
  ('think_tank',     'Think Tank',     'Idea capture and decision-driven ideation', false),
  ('dashboards',     'Dashboards',     'Mission Control hub and delivery intelligence', false),
  ('project_portal', 'Project Portal', 'Project Overview, Timeline and Costs', false)
on conflict (key) do nothing;

-- Existing tenants keep full access (override = ON) so current dogfood/early
-- tenants are unaffected. Tenants created AFTER this migration get no override
-- and therefore fall back to the global default (board-only) until released.
insert into public.tenant_feature_overrides (tenant_id, key, enabled)
  select t.id, f.key, true
  from public.tenants t
  cross join public.feature_flags f
on conflict (tenant_id, key) do nothing;

insert into public.schema_migrations (filename)
values ('0032_feature_flags.sql')
on conflict do nothing;
