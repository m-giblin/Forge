-- 0099: SCIM 2.0 provisioning/deprovisioning tokens.
--
-- One bearer token per tenant, configured once in the IdP's SCIM connector
-- settings (Okta, Azure AD, OneLogin, etc.). The IdP then calls Forge's
-- /api/scim/v2/* endpoints directly whenever a user is added, updated, or
-- removed from the company directory — no more waiting for a human admin to
-- notice someone left and manually remove them (the actual "deprovisioning"
-- gap this closes).

create table if not exists public.tenant_scim_tokens (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null unique references public.tenants(id) on delete cascade,
  token_hash    text        not null,
  enabled       boolean     not null default true,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

create index if not exists idx_tenant_scim_tokens_hash on public.tenant_scim_tokens (token_hash) where revoked_at is null;

alter table public.tenant_scim_tokens enable row level security;

-- Only owners/admins of the tenant may read or write their own SCIM token config.
-- The SCIM endpoints themselves authenticate via the bearer token (service-role
-- lookup), not via this RLS policy — this policy only gates the admin settings UI.
create policy "tenant_scim_tokens_select" on public.tenant_scim_tokens
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = tenant_scim_tokens.tenant_id
        and m.user_id = public.current_app_user_id()
        and m.role in ('owner', 'admin')
    )
  );

create policy "tenant_scim_tokens_write" on public.tenant_scim_tokens
  for all using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = tenant_scim_tokens.tenant_id
        and m.user_id = public.current_app_user_id()
        and m.role in ('owner', 'admin')
    )
  );

insert into public.schema_migrations (filename)
values ('0099_scim.sql')
on conflict do nothing;
