-- 0093: AI-generated sprint retrospective summary stored on the sprint row.
-- Generated on-demand (POST to generate endpoint), cached until next generate call.

alter table public.sprints
  add column if not exists retro_ai_summary   text,
  add column if not exists retro_generated_at timestamptz;
