-- 0006_super_admin.sql — platform super-admins, audit log, cross-tenant stats.
--
-- Super Admin is a SEPARATE identity from tenant roles. It is granted
-- out-of-band (SQL / script) and is never self-serve. Cross-tenant reads go
-- through the service-role client AFTER a requireSuperAdmin() check in code —
-- RLS never grants one tenant sight of another.

create table public.super_admins (
  user_id     uuid primary key references public.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.super_admins enable row level security;
-- A user may check ONLY their own super-admin status (for the dashboard link).
-- Listing/granting is service-role only.
create policy super_admins_self on public.super_admins
  for select using ( user_id = (select id from public.users where auth_id = auth.uid()) );

-- Audit log: tenant-scoped events (tenant_id set) and platform events (null).
create table public.audit_log (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid references public.tenants(id) on delete set null,
  actor_user_id  uuid references public.users(id) on delete set null,
  actor_label    text,                       -- email snapshot, durable across deletes
  action         text not null,              -- e.g. 'tenant.provision', 'tenant.suspend'
  target         text,                       -- affected entity (slug/id)
  metadata       jsonb not null default '{}',
  created_at     timestamptz not null default now()
);
create index idx_audit_tenant on public.audit_log(tenant_id);
create index idx_audit_created on public.audit_log(created_at desc);

alter table public.audit_log enable row level security;
-- Tenant owners/admins can read their own tenant's entries. Platform entries
-- (tenant_id null) are visible only via service-role (no policy matches them).
create policy audit_select_tenant on public.audit_log
  for select using (
    tenant_id is not null
    and public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
  );
-- No insert policy: audit writes happen through the service-role path only.

-- Cross-tenant stats for the platform console. security_invoker=true means the
-- view runs with the CALLER's RLS — a normal user sees only their tenants; the
-- super-admin reads it via service-role (BYPASSRLS) and sees all. No leak.
create view public.tenant_stats
with (security_invoker = true) as
select
  t.id, t.name, t.slug, t.status, t.plan, t.created_at,
  (select count(*) from public.memberships m where m.tenant_id = t.id) as member_count,
  (select count(*) from public.issues i where i.tenant_id = t.id) as issue_count
from public.tenants t;
