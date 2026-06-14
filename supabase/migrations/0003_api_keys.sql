-- 0003_api_keys.sql — Tenant-scoped API keys for the integration API.
--
-- Only a SHA-256 HASH of each key is stored; the raw key is shown once at
-- creation and never recoverable. Lookups on the machine path hash the
-- incoming key and match by key_hash (service-role, bypasses RLS). RLS below
-- governs the tenant-admin management UI path only.

create table public.api_keys (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,                         -- human label, e.g. "Travli prod"
  key_prefix  text not null,                         -- visible identifier, e.g. "forge_travli_a1b2"
  key_hash    text not null unique,                  -- sha-256 hex of the raw key
  scopes      text[] not null default '{}',          -- e.g. {'issues:read','issues:write'}
  created_by  uuid references public.users(id) on delete set null,
  last_used_at timestamptz,
  revoked_at  timestamptz,                           -- non-null = revoked
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_api_keys_tenant on public.api_keys(tenant_id);
-- key_hash already uniquely indexed by the unique constraint.

create trigger trg_api_keys_updated before update on public.api_keys
  for each row execute function public.set_updated_at();

alter table public.api_keys enable row level security;

-- Management is owner/admin only. The API consumption path does NOT use these
-- policies (it goes through the service-role client).
create policy api_keys_select on public.api_keys
  for select using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );
create policy api_keys_insert on public.api_keys
  for insert with check ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );
create policy api_keys_update on public.api_keys
  for update using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );
create policy api_keys_delete on public.api_keys
  for delete using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );
