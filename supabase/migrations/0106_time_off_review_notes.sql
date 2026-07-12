-- Migration 0106: time_off_requests.review_notes
-- Fixes a real gap found during the docs audit: the admin's rejection reason
-- was typed into the UI but never had anywhere to be persisted — `notes` is
-- the requester's own note from submission, not the reviewer's response.

alter table public.time_off_requests
  add column if not exists review_notes text;

insert into public.schema_migrations (filename) values ('0106_time_off_review_notes.sql') on conflict do nothing;
