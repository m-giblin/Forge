-- Migration 0126: add a phone number field to users, for the member profile
-- card (admin/members page) — the only "contact info" field this app tracks
-- beyond email. No RLS policy change needed: the existing users_update_self
-- policy (migration 0001) already covers a user editing their own phone, and
-- an admin editing a teammate's profile goes through the service-role client
-- (same convention as every other admin-on-behalf-of-member write in
-- src/app/[tenant]/admin/members/actions.ts, e.g. setJobTitlesAction).

alter table public.users add column if not exists phone text;

insert into public.schema_migrations (filename)
  values ('0126_user_phone.sql')
  on conflict (filename) do nothing;
