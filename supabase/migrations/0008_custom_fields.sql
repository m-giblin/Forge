-- 0008_custom_fields.sql — per-tenant generic custom fields (Phase 2).
--
-- Each tenant defines its own custom fields; values are stored on the issue's
-- existing `custom_values` JSONB (added in 0007), keyed by the field's `key`.
-- No per-customer columns — config + JSONB (see architecture: customize by
-- configuration, not schema-per-tenant).

create table public.tenant_custom_fields (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  key         text not null,                                  -- key in issues.custom_values
  label       text not null,
  type        text not null check (type in ('text', 'number', 'select', 'date')),
  options     text[] not null default '{}',                   -- for type = 'select'
  required    boolean not null default false,
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  unique (tenant_id, key)
);
create index idx_tcf_tenant on public.tenant_custom_fields(tenant_id);

alter table public.tenant_custom_fields enable row level security;

create policy tcf_select on public.tenant_custom_fields
  for select using ( tenant_id in (select public.current_tenant_ids()) );
create policy tcf_write on public.tenant_custom_fields
  for all using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) )
  with check ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );
