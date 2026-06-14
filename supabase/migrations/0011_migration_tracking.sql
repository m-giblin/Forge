-- 0011_migration_tracking.sql
-- Migration drift guardrail: creates schema_migrations tracking table and
-- backfills all previously-applied migrations (0001-0010).
--
-- Going forward, each migration file ends with an INSERT here so the DB
-- always knows exactly what has been applied.
--
-- Apply via: Supabase Dashboard → SQL Editor, or `npm run db:migrate`
--   (auto-apply requires SUPABASE_ACCESS_TOKEN in .env.local)

-- Service-role has BYPASSRLS so no RLS policy needed here.
create table if not exists public.schema_migrations (
  filename   text        primary key,
  applied_at timestamptz not null default now(),
  checksum   text,
  notes      text
);

comment on table public.schema_migrations is
  'Migration drift guardrail — one row per applied SQL file. See scripts/db-migrate.mjs.';

-- Backfill previously applied migrations (0001-0010)
insert into public.schema_migrations (filename, notes) values
  ('0001_init_multitenancy.sql',    'backfilled — applied before tracking'),
  ('0002_issues.sql',               'backfilled — applied before tracking'),
  ('0003_api_keys.sql',             'backfilled — applied before tracking'),
  ('0004_issue_idempotency.sql',    'backfilled — applied before tracking'),
  ('0005_invites.sql',              'backfilled — applied before tracking'),
  ('0006_super_admin.sql',          'backfilled — applied before tracking'),
  ('0007_configurable_schema.sql',  'backfilled — applied before tracking'),
  ('0008_custom_fields.sql',        'backfilled — applied before tracking'),
  ('0009_projects_governance.sql',  'backfilled — applied before tracking'),
  ('0010_platform_settings.sql',    'backfilled — applied before tracking'),
  ('0011_migration_tracking.sql',   'self-registration')
on conflict (filename) do nothing;
