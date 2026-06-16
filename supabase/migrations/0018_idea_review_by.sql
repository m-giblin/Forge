-- Adds an optional review-by date to ideas so teams can flag staleness.
-- Purely additive — no existing rows or policies affected.
alter table public.ideas
  add column if not exists review_by date;

insert into public.schema_migrations (filename)
values ('0018_idea_review_by.sql')
on conflict do nothing;
