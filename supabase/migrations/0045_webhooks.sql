-- 0045_webhooks.sql
-- Outbound webhook endpoints per tenant.
create table if not exists public.webhook_endpoints (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  url         text not null,
  secret      text not null,
  events      text[] not null default '{}',
  enabled     boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists webhook_endpoints_tenant on public.webhook_endpoints(tenant_id);
alter table public.webhook_endpoints enable row level security;
create policy webhook_endpoints_admin on public.webhook_endpoints
  for all using (
    exists (
      select 1 from public.memberships m
      join public.users u on u.id = m.user_id
      where m.tenant_id = webhook_endpoints.tenant_id
        and u.auth_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );
insert into public.schema_migrations (filename) values ('0045_webhooks.sql') on conflict do nothing;
