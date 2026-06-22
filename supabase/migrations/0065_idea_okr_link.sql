-- Migration 0065: Link Think Tank ideas to OKR objectives
-- Adds linked_okr_id FK on ideas → okrs

alter table public.ideas
  add column if not exists linked_okr_id uuid references public.okrs(id) on delete set null;

create index if not exists ideas_linked_okr_id_idx on public.ideas(linked_okr_id);

insert into public.schema_migrations (filename)
  values ('0065_idea_okr_link.sql')
  on conflict (filename) do nothing;
