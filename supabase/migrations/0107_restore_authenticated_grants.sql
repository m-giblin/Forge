-- 0107_restore_authenticated_grants.sql
--
-- EMERGENCY FIX: every table in schema public lost its base Postgres GRANTs
-- for the `authenticated` role (RLS policies were still intact and correct,
-- but Postgres denies access at the table-privilege level before RLS is even
-- evaluated, producing "permission denied for table X" for every signed-in
-- user across every tenant). RLS remains the real per-row security boundary;
-- these grants just restore the baseline access Supabase projects ship with
-- by default. Also re-applies as a default privilege so tables created by
-- future migrations don't need this repeated by hand.

grant usage on schema public to authenticated, anon;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;

insert into public.schema_migrations (filename)
values ('0107_restore_authenticated_grants.sql')
on conflict do nothing;
