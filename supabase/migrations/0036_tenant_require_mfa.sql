-- 0036: tenant-level MFA enforcement
-- Admins can require all members to complete TOTP MFA before accessing the workspace.
-- Default false (existing tenants unaffected until an admin explicitly enables it).

alter table public.tenants
  add column if not exists require_mfa boolean not null default false;

insert into public.schema_migrations (filename)
values ('0036_tenant_require_mfa.sql') on conflict do nothing;
