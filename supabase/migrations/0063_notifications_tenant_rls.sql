-- Tighten notifications RLS to enforce tenant_id isolation.
-- Previously policies only checked user_id, allowing cross-tenant leakage
-- for users who belong to multiple tenants.

drop policy if exists "users read own notifications" on public.notifications;
drop policy if exists "users update own notifications" on public.notifications;
drop policy if exists "users delete own notifications" on public.notifications;

-- Read: must be in the same tenant AND be the recipient
create policy "notifications_select"
  on public.notifications for select
  using (
    user_id = public.current_app_user_id()
    and exists (
      select 1 from public.memberships m
      where m.tenant_id = notifications.tenant_id
        and m.user_id = public.current_app_user_id()
    )
  );

-- Update (mark read): same constraint
create policy "notifications_update"
  on public.notifications for update
  using (
    user_id = public.current_app_user_id()
    and exists (
      select 1 from public.memberships m
      where m.tenant_id = notifications.tenant_id
        and m.user_id = public.current_app_user_id()
    )
  )
  with check (
    user_id = public.current_app_user_id()
    and exists (
      select 1 from public.memberships m
      where m.tenant_id = notifications.tenant_id
        and m.user_id = public.current_app_user_id()
    )
  );

-- Delete: same constraint
create policy "notifications_delete"
  on public.notifications for delete
  using (
    user_id = public.current_app_user_id()
    and exists (
      select 1 from public.memberships m
      where m.tenant_id = notifications.tenant_id
        and m.user_id = public.current_app_user_id()
    )
  );

insert into public.schema_migrations (filename)
  values ('0063_notifications_tenant_rls.sql')
  on conflict (filename) do nothing;
