-- 0089_fix_rls_uuid_mismatch.sql
--
-- Fix: memberships.user_id stores public.users.id (app UUID), NOT auth.uid() (Supabase auth UUID).
-- Comparing m.user_id = auth.uid() silently fails for all user-JWT RLS checks.
-- The correct pattern is: m.user_id = public.current_app_user_id()
-- OR:                      m.user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
--
-- public.current_app_user_id() is defined in 0001_init_multitenancy.sql and is the canonical way.
-- public.has_tenant_role() already uses the correct pattern.
--
-- Tables patched in this migration:
--   1. spaces helpers / policies (0083_spaces.sql)
--   2. custom_roles policy (0057_rbac.sql)
--
-- All other tables use has_tenant_role() which is already correct, or use
-- tenant_id-only membership checks which are also fine.

-- ── 1. spaces: fix can_read_space() helper function ──────────────────────────
-- The function compared m.user_id = auth.uid() and s.owner_id = auth.uid()
-- Both are app UUIDs and must be compared to current_app_user_id().

create or replace function public.can_read_space(p_space_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.spaces s
    join public.memberships m
      on m.tenant_id = s.tenant_id
      and m.user_id = public.current_app_user_id()
    where s.id = p_space_id
      and s.archived_at is null
      and (
        s.type = 'team'
        or (s.type = 'personal' and s.owner_id = public.current_app_user_id())
        or s.type = 'project'
      )
  )
$$;

-- ── 2. spaces: fix spaces_update policy (owner_id = auth.uid()) ─────────────
drop policy if exists spaces_update on public.spaces;
create policy spaces_update on public.spaces
  for update using (
    public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
    or owner_id = public.current_app_user_id()
  );

-- ── 3. pages: fix pages_select policy (m.user_id = auth.uid()) ───────────────
drop policy if exists pages_select on public.pages;
create policy pages_select on public.pages
  for select using (
    exists (
      select 1 from public.spaces s
      join public.memberships m
        on m.tenant_id = s.tenant_id
        and m.user_id = public.current_app_user_id()
      where s.id = pages.space_id
    )
  );

-- ── 4. page_shares: fix page_shares_update policy (created_by = auth.uid()) ──
drop policy if exists page_shares_update on public.page_shares;
create policy page_shares_update on public.page_shares
  for update using (
    public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
    or created_by = public.current_app_user_id()
  );

-- ── 5. custom_roles: fix tenant_members_read_custom_roles policy ─────────────
drop policy if exists "tenant_members_read_custom_roles" on public.custom_roles;
create policy "tenant_members_read_custom_roles"
  on public.custom_roles for select
  using (
    exists (
      select 1 from public.memberships
      where memberships.tenant_id = custom_roles.tenant_id
        and memberships.user_id = public.current_app_user_id()
    )
  );
