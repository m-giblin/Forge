-- Migration 0125: Components (tenant-wide, per decision in Docs/design-gaps.md
-- "Planning & Hierarchy" phase — matches the existing precedent set by Issue
-- Types/Statuses/Priorities (0007) and Custom Fields (0008): "customize by
-- configuration, not schema-per-tenant" (0008's own comment). Not scoped
-- per-project, unlike tenant_categories.

create table public.tenant_components (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index idx_tcomp_tenant on public.tenant_components(tenant_id);

alter table public.tenant_components enable row level security;

create policy tcomp_select on public.tenant_components
  for select using ( tenant_id in (select public.current_tenant_ids()) );
create policy tcomp_write on public.tenant_components
  for all using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) )
  with check ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

alter table public.issues add column component_id uuid references public.tenant_components(id) on delete set null;

insert into public.schema_migrations (filename)
  values ('0125_tenant_components.sql')
  on conflict (filename) do nothing;
