-- Migration 0123: close a schema-drift blind spot found by the 2026-07-29
-- security audit (Medium #1). Two tables — `ticket_comments` and
-- `request_throttle` — exist live with zero matching migration file anywhere
-- in this directory, so their RLS state could not be confirmed from the
-- tracked schema history at all (not "misconfigured", genuinely unknown).
--
-- ticket_comments: has a tenant_id FK and an is_internal flag for staff-only
-- notes, but no tracked migration ever enabled RLS or added a policy for it.
-- Every real app-code path (src/lib/repositories/ticketComments.ts, called
-- from src/app/[tenant]/{admin/,}support/actions.ts) already goes through the
-- service-role client with an explicit tenant_id filter, so this is
-- defense-in-depth against a future anon/JWT-based access path, not a fix for
-- an active exploit. Mirrors the sibling support_tickets table's policy
-- pattern (migration 0054): owner/admin only, via has_tenant_role().
--
-- request_throttle: an orphaned rate-limiter table with zero rows and zero
-- references anywhere in supabase/migrations/ or src/ (confirmed via
-- exhaustive grep). Superseded by rate_limit_buckets (migration 0012,
-- rl_increment()), which is the one actually used by
-- src/lib/providers/rate-limiter.ts and has live traffic. Dropped as dead
-- schema rather than left as an unaudited, unused surface.

alter table public.ticket_comments enable row level security;

drop policy if exists "ticket_comments_select" on public.ticket_comments;
create policy "ticket_comments_select" on public.ticket_comments
  for select using (
    public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
  );

drop policy if exists "ticket_comments_insert" on public.ticket_comments;
create policy "ticket_comments_insert" on public.ticket_comments
  for insert with check (
    public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
  );

-- Super-admin support console reads across all tenants via service-role
-- (BYPASSRLS) — no extra policy needed, same as support_tickets.

drop table if exists public.request_throttle;

insert into public.schema_migrations (filename)
  values ('0123_ticket_comments_rls_drop_request_throttle.sql')
  on conflict (filename) do nothing;
