-- Migration 0092: Add alignment_score to idea_okr_links
-- Stores the 1-5 AI alignment score between an idea and an OKR.

alter table public.idea_okr_links
  add column if not exists alignment_score smallint check (alignment_score between 1 and 5);

insert into public.schema_migrations (filename)
  values ('0092_idea_okr_alignment_score.sql')
  on conflict (filename) do nothing;
