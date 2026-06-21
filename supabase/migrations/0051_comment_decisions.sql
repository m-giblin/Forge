-- Migration 0051: Decision comment type for issue comments
-- Adds a `comment_type` column to issue_comments so PMs and owners
-- can mark a comment as an official "Decision" (displayed differently
-- in the issue timeline with the 💡 Decision badge).
-- Values: 'comment' (default) | 'decision'

alter table public.issue_comments
  add column if not exists comment_type text not null default 'comment'
    check (comment_type in ('comment', 'decision'));

-- Index for filtering decision comments per issue (e.g. "show all decisions" tab)
create index if not exists idx_issue_comments_type
  on public.issue_comments(issue_id, comment_type)
  where comment_type = 'decision';

insert into public.schema_migrations (filename)
  values ('0051_comment_decisions.sql')
  on conflict (filename) do nothing;
