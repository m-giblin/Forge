-- 0098: real SAML 2.0 SSO, on top of the existing tenant_sso_config table.
--
-- Forge's Supabase project already has the SSO admin API enabled (verified
-- live: GET /auth/v1/admin/sso/providers returns 200, not a feature-gate
-- error), so this registers real per-tenant SAML identity providers with
-- Supabase's own GoTrue backend rather than hand-rolling SAML assertion
-- parsing/signature verification — that's the expensive, security-sensitive
-- part or "why is enterprise SSO an L-effort item," and Supabase already
-- does it.

alter table public.tenant_sso_config
  drop constraint if exists tenant_sso_config_provider_check;

alter table public.tenant_sso_config
  add constraint tenant_sso_config_provider_check
  check (provider in ('google', 'microsoft', 'both', 'saml'));

alter table public.tenant_sso_config
  add column if not exists saml_metadata_url text,
  add column if not exists saml_metadata_xml text,
  add column if not exists supabase_sso_provider_id text,
  add column if not exists sso_domain text;

-- One tenant maps to at most one registered Supabase SSO provider.
create unique index if not exists uq_tenant_sso_config_provider_id
  on public.tenant_sso_config (supabase_sso_provider_id)
  where supabase_sso_provider_id is not null;

insert into public.schema_migrations (filename)
values ('0098_saml_sso.sql')
on conflict do nothing;
