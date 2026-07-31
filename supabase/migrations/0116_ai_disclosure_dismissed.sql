-- 0116_ai_disclosure_dismissed.sql — persist the "AI features active" banner
-- dismissal server-side, per user. Previously localStorage-only, so it
-- reappeared any time the browser/device changed or site data was cleared
-- (e.g. incognito windows, browser privacy settings clearing storage between
-- sessions) even though the user had already dismissed it. A real account
-- preference, so it belongs on the user's own row, not a tenant setting —
-- one dismissal covers every workspace the user belongs to.

alter table public.users
  add column if not exists ai_disclosure_dismissed_at timestamptz;

insert into public.schema_migrations (filename)
values ('0116_ai_disclosure_dismissed.sql') on conflict do nothing;
