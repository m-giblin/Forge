-- 0015_projects_linked_idea.sql
-- Adds linked_idea_id to projects — the reverse-link from a converted idea.
-- Purely additive: nullable column, IF NOT EXISTS, no existing rows affected.
-- Must be applied AFTER 0014 (ideas table must exist first).

alter table public.projects
  add column if not exists linked_idea_id uuid references public.ideas(id) on delete set null;

-- schema_migrations tracking
insert into public.schema_migrations (filename, notes) values
  ('0015_projects_linked_idea.sql', 'projects: add linked_idea_id (reverse link from converted idea)')
on conflict (filename) do nothing;
