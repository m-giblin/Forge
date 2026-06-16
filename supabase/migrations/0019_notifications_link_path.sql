-- Adds a generic link_path to notifications so non-issue events (e.g. Think
-- Tank comments, status changes) can carry their own navigation target.
-- Purely additive — existing rows get NULL, existing queries are unaffected.
alter table public.notifications
  add column if not exists link_path text;

insert into public.schema_migrations (filename)
values ('0019_notifications_link_path.sql')
on conflict do nothing;
