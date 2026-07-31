-- Migration 0124: drop a dead, superseded RLS policy on
-- idea_comment_attachments (2026-07-29 security audit, Info #1).
--
-- Migration 0021 created policy "tenant members read attachments" using
-- `user_id = auth.uid()` — the pre-0103 uuid-mismatch bug, since
-- memberships.user_id references public.users(id) (the app-level user row),
-- not auth.uid() (the Supabase auth user id). Those are different uuid
-- spaces, so this policy's condition never actually matches any real row —
-- it has been a permanent no-op since it was created.
--
-- Migration 0103's uuid-mismatch sweep added the real, correctly-scoped
-- replacement — policy "tenant members read idea attachments" (note the
-- extra word), using public.current_app_user_id(). But its own
-- `drop policy if exists "tenant members read idea attachments"` only
-- matched that new name, not the original 0021 policy's name
-- ("tenant members read attachments") — so the dead policy from 0021 was
-- never actually dropped and has been sitting alongside the correct one ever
-- since. Harmless (Postgres ORs multiple permissive select policies
-- together, and this one never contributes anything), but dead clutter.

drop policy if exists "tenant members read attachments" on public.idea_comment_attachments;

insert into public.schema_migrations (filename)
  values ('0124_drop_dead_idea_comment_attachments_policy.sql')
  on conflict (filename) do nothing;
