-- Migration 0067: Per-type notification preferences on users
-- notification_prefs: JSONB map of notification type -> { email: bool, inApp: bool }
-- Default null = all notifications on (fail-open for new users)

alter table public.users
  add column if not exists notification_prefs jsonb;

comment on column public.users.notification_prefs is
  'Per-type notification preferences. null = all on. Example: {"issue_assigned":{"email":true,"in_app":true},"issue_comment":{"email":false,"in_app":true}}';

insert into public.schema_migrations (filename)
  values ('0067_notification_prefs.sql')
  on conflict (filename) do nothing;
