-- Migration 0024: add token counts to idea_ai_turns
-- Captures input/output tokens from each AI provider response for usage tracking.

alter table public.idea_ai_turns
  add column if not exists tokens_input  integer,
  add column if not exists tokens_output integer;

insert into public.schema_migrations (filename, notes)
  values ('0024_ai_turns_tokens.sql', 'Add tokens_input/tokens_output to idea_ai_turns for usage tracking')
  on conflict (filename) do nothing;
