-- 0013_drop_legacy_enums.sql
-- Drop the legacy issue_status / issue_priority / issue_type Postgres ENUM
-- types left over from before migration 0007 switched those columns to TEXT.
-- They are unreferenced and harmless but add noise. IF EXISTS means this is
-- safe to re-run; omitting CASCADE means it will fail loudly if something
-- outside our codebase still depends on them (rather than silently breaking).

drop type if exists issue_status;
drop type if exists issue_priority;
drop type if exists issue_type;

insert into public.schema_migrations (filename) values ('0013_drop_legacy_enums.sql') on conflict do nothing;
