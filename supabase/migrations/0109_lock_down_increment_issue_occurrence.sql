-- Migration 0109: restrict increment_issue_occurrence to service-role only
--
-- Security audit finding: this function is SECURITY DEFINER (bypasses RLS)
-- and had no REVOKE, so Postgres's default EXECUTE-to-PUBLIC grant was still
-- in effect — any authenticated client could call it directly via
-- POST /rest/v1/rpc/increment_issue_occurrence with an arbitrary issue_id
-- from ANY tenant and tamper with that issue's occurrence_count/last_seen_at,
-- with no tenant check anywhere in the call path.
--
-- Its one legitimate call site (src/app/api/v1/issues/route.ts fingerprint
-- dedup) already runs through the service-role client and only ever passes
-- an issue_id it just fetched with an explicit tenant_id + project_id filter
-- — so locking execution to service_role matches how it's actually used and
-- closes the direct-RPC-call path entirely.

revoke execute on function public.increment_issue_occurrence(uuid) from public;
revoke execute on function public.increment_issue_occurrence(uuid) from anon;
revoke execute on function public.increment_issue_occurrence(uuid) from authenticated;
grant execute on function public.increment_issue_occurrence(uuid) to service_role;
