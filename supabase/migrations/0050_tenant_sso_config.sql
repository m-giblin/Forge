-- SSO configuration per tenant (Google / Microsoft OIDC).
-- Only one row per tenant; owner/admin manage it via the admin settings UI.
create table if not exists tenant_sso_config (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       uuid        not null unique references tenants(id) on delete cascade,
  enabled         boolean     not null default false,
  -- 'google' | 'microsoft' | 'both'
  provider        text        not null default 'google'
                              check (provider in ('google', 'microsoft', 'both')),
  -- If set, only emails from this domain are allowed via SSO (e.g. 'acme.com').
  -- Leave null to allow any email.
  allowed_domain  text,
  -- Automatically add first-time SSO users as workspace members (role = member).
  auto_provision  boolean     not null default true,
  -- If true, users whose email matches allowed_domain must use SSO (cannot use password).
  sso_required    boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Only owners/admins of the tenant may read or write the SSO config.
alter table tenant_sso_config enable row level security;

create policy "tenant_sso_config_select" on tenant_sso_config
  for select using (
    exists (
      select 1 from memberships m
      where m.tenant_id = tenant_sso_config.tenant_id
        and m.user_id = (select id from users where auth_id = auth.uid())
        and m.role in ('owner', 'admin')
    )
  );

create policy "tenant_sso_config_write" on tenant_sso_config
  for all using (
    exists (
      select 1 from memberships m
      where m.tenant_id = tenant_sso_config.tenant_id
        and m.user_id = (select id from users where auth_id = auth.uid())
        and m.role in ('owner', 'admin')
    )
  );
