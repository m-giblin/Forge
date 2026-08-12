-- Migration 0129: user-selectable avatar color (Forge-Works Updates doc, item 6).
-- Nullable text column storing a hex color the user picked in Settings; when
-- null, avatar rendering falls back to the existing id-hash color it always
-- used. No RLS policy change needed — same as migration 0126 (phone), the
-- existing users_update_self policy already covers a user editing their own
-- row, and admin-on-behalf-of-member writes go through the service-role
-- client per the standing convention.

alter table public.users add column if not exists avatar_color text;

insert into public.schema_migrations (filename)
  values ('0129_avatar_color.sql')
  on conflict (filename) do nothing;
