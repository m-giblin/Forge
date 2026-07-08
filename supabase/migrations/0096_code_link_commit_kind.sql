-- 0096: make issue_code_links support commit-type links correctly.
--
-- Two problems with the AI Commit Linker as first shipped (0095):
--   1. link_kind 'commit' was not in the CHECK allow-list, so every commit
--      insert failed the constraint and was silently swallowed.
--   2. commits were forced to pr_number = 0, so the unique key
--      (tenant_id, issue_id, repo_full_name, pr_number) collapsed every commit
--      for an issue+repo into a single row — later commits overwrote earlier.
--
-- Fix: allow 'commit' as a link_kind, make pr_number nullable (commits have no
-- PR number; NULLs are distinct in the existing unique constraint so PRs are
-- unaffected), and dedup commits on their SHA via a partial unique index.

-- 1. Allow 'commit' in the link_kind check.
alter table public.issue_code_links
  drop constraint if exists issue_code_links_link_kind_check;

alter table public.issue_code_links
  add constraint issue_code_links_link_kind_check
  check (link_kind in ('branch', 'title', 'body', 'ref', 'commit'));

-- 2. Commits carry no PR number — store NULL instead of the 0 sentinel.
alter table public.issue_code_links
  alter column pr_number drop not null;

-- 3. Dedup commit links by SHA (one row per issue+repo+commit), while leaving
--    the original (tenant_id, issue_id, repo_full_name, pr_number) unique
--    constraint to govern PR links (NULL pr_numbers are distinct, so they
--    never collide there).
create unique index if not exists uq_issue_code_links_commit
  on public.issue_code_links (tenant_id, issue_id, repo_full_name, commit_sha)
  where link_kind = 'commit';

insert into public.schema_migrations (filename)
values ('0096_code_link_commit_kind.sql')
on conflict do nothing;
