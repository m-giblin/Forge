-- 0035: issue comment threading
-- Adds parent_id to issue_comments for 1-level threaded replies.
-- Self-referential FK; ON DELETE SET NULL so deleting a parent comment
-- does not cascade-delete its replies (they become top-level orphans in the UI).
-- RLS policies unchanged: SELECT + INSERT only (no edit/delete for users).

alter table public.issue_comments
  add column if not exists parent_id uuid references public.issue_comments(id) on delete set null;

create index if not exists idx_issue_comments_parent on public.issue_comments(parent_id);

insert into public.schema_migrations (filename)
values ('0035_issue_comment_threading.sql') on conflict do nothing;
