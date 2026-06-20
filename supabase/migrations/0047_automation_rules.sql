-- 0047_automation_rules.sql
create table if not exists public.automation_rules (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  enabled     boolean not null default true,
  trigger     text not null,
  conditions  jsonb not null default '[]',
  actions     jsonb not null default '[]',
  created_at  timestamptz not null default now()
);
create index if not exists automation_rules_tenant on public.automation_rules(tenant_id);
alter table public.automation_rules enable row level security;
create policy automation_rules_admin on public.automation_rules
  for all using (
    exists (
      select 1 from public.memberships m
      join public.users u on u.id = m.user_id
      where m.tenant_id = automation_rules.tenant_id
        and u.auth_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );
insert into public.schema_migrations (filename) values ('0047_automation_rules.sql') on conflict do nothing;
