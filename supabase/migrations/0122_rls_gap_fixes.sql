-- 0122_rls_gap_fixes.sql
--
-- Security audit finding (RLS-01): sla_events carries an overly-permissive
-- policy created in 0048_sla.sql:
--
--   create policy "service role manage sla_events" on sla_events
--     using (true)
--     with check (true);
--
-- This policy has no `for <command>` clause (defaults to ALL: select/insert/
-- update/delete) and no `to <role>` clause (defaults to PUBLIC — every role,
-- not just service_role). Postgres RLS policies apply per-role via `to`, not
-- by name; without it, `using (true) with check (true)` grants unconditional
-- read/write/delete to EVERY role that also holds a table-level GRANT.
--
-- 0107_restore_authenticated_grants.sql grants
--   select, insert, update, delete on all tables in schema public
--   to authenticated
-- (the standard Supabase baseline — RLS is meant to be the real boundary).
-- Combined with the policy above, any signed-in user of ANY tenant can
-- insert, update, or delete sla_events rows for ANY OTHER tenant directly via
-- PostgREST (using nothing but the public anon key + their own session JWT),
-- completely bypassing the app's service-role-only code paths. This is a
-- real, currently-exploitable cross-tenant IDOR at the database layer.
--
-- service_role already has BYPASSRLS (Supabase default), so it never needed
-- an explicit policy to read/write this table — the "service role manage"
-- policy was redundant even for its intended purpose. Fix: drop it. Members'
-- existing "members read sla_events" select policy (correctly tenant-scoped,
-- fixed for the uuid-mismatch bug in 0103) is untouched and remains the only
-- policy — read-only for tenant members, full read/write for service_role
-- via BYPASSRLS, and default-deny for every other write path, matching the
-- documented intentional pattern used by ai_usage_events (0101) and
-- api_call_events (0120).

drop policy if exists "service role manage sla_events" on public.sla_events;

-- No replacement policy needed: service_role bypasses RLS entirely, and app
-- code (src/lib/repositories/slaPolicies.ts, src/lib/services/sla.ts) only
-- ever writes sla_events via createSupabaseServiceClient().

insert into public.schema_migrations (filename)
values ('0122_rls_gap_fixes.sql')
on conflict do nothing;
