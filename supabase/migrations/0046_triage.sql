-- 0046_triage.sql
-- AI triage suggestion stored as JSONB on the issue row.
alter table public.issues add column if not exists triage_suggestion jsonb;
insert into public.schema_migrations (filename) values ('0046_triage.sql') on conflict do nothing;
