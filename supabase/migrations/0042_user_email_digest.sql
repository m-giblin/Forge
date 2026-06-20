-- Users: opt-out flag for weekly email digest.
alter table public.users add column if not exists email_digest boolean not null default true;

insert into public.schema_migrations (filename) values ('0042_user_email_digest.sql') on conflict do nothing;
