-- 0034: project status lifecycle
-- Adds a status column to projects. Defaults to 'active'.
-- archived projects are hidden from all normal list views; only
-- admins can see them via the dedicated archive section.

alter table public.projects
  add column if not exists status text not null default 'active'
    check (status in ('active', 'on_hold', 'closed', 'archived'));

comment on column public.projects.status is
  'active=in progress, on_hold=paused, closed=completed/cancelled, archived=hidden (admin-only, restorable)';

insert into public.schema_migrations (filename)
values ('0034_project_status.sql') on conflict do nothing;
