-- Migration 0026: tenant-created idea templates

create table if not exists public.tenant_idea_templates (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  label        text not null,
  description  text not null default '',
  suggested_pill_ids text[] not null default '{}',
  sort_order   integer not null default 0,
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_tenant_idea_templates_tenant on public.tenant_idea_templates(tenant_id);

create trigger trg_tenant_idea_templates_updated
  before update on public.tenant_idea_templates
  for each row execute function public.set_updated_at();

alter table public.tenant_idea_templates enable row level security;

create policy tenant_idea_templates_select on public.tenant_idea_templates
  for select using (tenant_id in (select public.current_tenant_ids()));

create policy tenant_idea_templates_insert on public.tenant_idea_templates
  for insert with check (
    public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
  );

create policy tenant_idea_templates_update on public.tenant_idea_templates
  for update using (
    public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
  );

create policy tenant_idea_templates_delete on public.tenant_idea_templates
  for delete using (
    public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
  );

notify pgrst, 'reload schema';

insert into public.schema_migrations (filename, notes)
  values ('0026_tenant_idea_templates.sql', 'Tenant-created idea templates')
  on conflict (filename) do nothing;
