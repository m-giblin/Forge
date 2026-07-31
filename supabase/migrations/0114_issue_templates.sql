-- 0114_issue_templates.sql — per-tenant, admin-configurable issue templates
-- (name, type, priority, title-prefix) for the quick-create form. Replaces
-- the previously-hardcoded 5-item template list in NewIssueForm.tsx with a
-- real tenant-owned table, following the same pattern as tenant_field_options
-- (0007). Seeded with those same 5 defaults so existing tenants see no
-- behavior change until they customize.

create table public.tenant_issue_templates (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  name         text not null,
  title_prefix text not null default '',
  type         text not null,
  priority     text not null,
  position     int not null default 0,
  created_at   timestamptz not null default now(),
  unique (tenant_id, name)
);
create index idx_tit_tenant on public.tenant_issue_templates(tenant_id);

alter table public.tenant_issue_templates enable row level security;

create policy tit_select on public.tenant_issue_templates
  for select using ( tenant_id in (select public.current_tenant_ids()) );
create policy tit_write on public.tenant_issue_templates
  for all using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) )
  with check ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

create or replace function public.seed_tenant_issue_templates(p_tenant uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.tenant_issue_templates (tenant_id, name, title_prefix, type, priority, position) values
    (p_tenant, 'Bug report',      '[Bug] ',      'bug',     'high',   0),
    (p_tenant, 'Feature request', '[Feature] ',  'feature', 'medium', 1),
    (p_tenant, 'Tech debt',       '[Debt] ',     'task',    'low',    2),
    (p_tenant, 'Security issue',  '[Security] ', 'bug',     'urgent', 3),
    (p_tenant, 'Task',            '',            'task',    'medium', 4)
  on conflict (tenant_id, name) do nothing;
end;
$$;

-- backfill every existing tenant
do $$
declare t record;
begin
  for t in select id from public.tenants loop
    perform public.seed_tenant_issue_templates(t.id);
  end loop;
end $$;

-- seed automatically for any future tenant
create or replace function public.trg_seed_tenant_issue_templates()
returns trigger language plpgsql as $$
begin
  perform public.seed_tenant_issue_templates(new.id);
  return new;
end;
$$;
create trigger trg_tenants_seed_issue_templates
  after insert on public.tenants
  for each row execute function public.trg_seed_tenant_issue_templates();

insert into public.schema_migrations (filename)
values ('0114_issue_templates.sql') on conflict do nothing;
