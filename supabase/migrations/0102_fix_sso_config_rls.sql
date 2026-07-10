-- 0102_fix_sso_config_rls.sql
--
-- F-04 (CIO/CISO audit, 2026-07-10): tenant_sso_config's RLS policies
-- (0050_tenant_sso_config.sql) compare membership via an inline
-- `(select id from users where auth_id = auth.uid())` lookup instead of
-- public.current_app_user_id() — the exact class of bug 0089 fixed for
-- spaces/custom_roles. Not exploited today (the admin SSO settings path
-- writes via service-role, which bypasses RLS entirely), but it's a latent
-- defense-in-depth defect: any future anon/JWT read path against this table
-- would mis-evaluate the membership check on SSO config (allowed domains,
-- auto-provision, MFA enforcement) — admin-sensitive data.

drop policy if exists "tenant_sso_config_select" on public.tenant_sso_config;
drop policy if exists "tenant_sso_config_write" on public.tenant_sso_config;

create policy "tenant_sso_config_select" on public.tenant_sso_config
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = tenant_sso_config.tenant_id
        and m.user_id = public.current_app_user_id()
        and m.role in ('owner', 'admin')
    )
  );

create policy "tenant_sso_config_write" on public.tenant_sso_config
  for all using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = tenant_sso_config.tenant_id
        and m.user_id = public.current_app_user_id()
        and m.role in ('owner', 'admin')
    )
  );

insert into public.schema_migrations (filename)
values ('0102_fix_sso_config_rls.sql')
on conflict do nothing;
