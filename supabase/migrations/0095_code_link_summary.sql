-- 0095: AI commit summary on issue_code_links.
-- ai_summary: Grok-generated one-sentence summary of what the commit/PR changed.
-- commit_sha: the specific commit SHA for commit-type links (separate from pr_number).

alter table public.issue_code_links
  add column if not exists ai_summary  text,
  add column if not exists commit_sha  text;
