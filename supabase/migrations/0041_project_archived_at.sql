-- Projects: soft-archive support.
alter table public.projects add column if not exists archived_at timestamptz;
alter table public.projects add column if not exists description text;

insert into public.schema_migrations (filename) values ('0041_project_archived_at.sql') on conflict do nothing;
