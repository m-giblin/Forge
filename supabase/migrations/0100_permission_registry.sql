-- 0100: Permission registry — the durable fix for RBAC, not a band-aid.
--
-- Before this, the set of valid permissions, their labels/descriptions, and
-- the member/viewer default access level were all hardcoded in rbac.ts.
-- Adding a permission for a new feature area meant a code change + deploy.
-- This moves that catalog into the database (mirrors the existing
-- feature_flags pattern: global platform-managed definitions), so a new
-- permission for a new feature is "add a row via /admin/permissions," not a
-- deploy. What still requires code: the actual server action that enforces
-- a permission — no schema change can make a mutation start checking
-- something it never calls. See scripts/audit-rbac.mjs for the safety net
-- that catches an action shipped without one.

create table if not exists public.permission_definitions (
  key             text primary key,
  label           text not null,
  description     text not null,
  group_name      text not null,
  member_default  boolean not null default false,
  viewer_default  boolean not null default false,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.permission_definitions enable row level security;
-- Service-role only (platform super-admin manages this, same as feature_flags).

create or replace trigger permission_definitions_updated_at
  before update on public.permission_definitions
  for each row execute procedure public.set_updated_at();

-- Seed with the exact 12 permissions + defaults that were previously
-- hardcoded in rbac.ts, so no tenant's existing custom roles change meaning.
insert into public.permission_definitions (key, label, description, group_name, member_default, viewer_default) values
  ('create_issues',   'Create issues',       'Can file new bugs, tasks, or feature requests',        'Issues',    true,  false),
  ('edit_any_issue',  'Edit any issue',      'Can edit issues not assigned to them',                 'Issues',    false, false),
  ('delete_issues',   'Delete issues',       'Can permanently delete issues',                        'Issues',    false, false),
  ('manage_sprints',  'Manage sprints',      'Can create, start, and complete sprints',              'Planning',  false, false),
  ('manage_projects', 'Manage projects',     'Can create and archive projects',                      'Planning',  false, false),
  ('manage_roadmap',  'Edit roadmap',        'Can add and edit roadmap items',                       'Planning',  false, false),
  ('view_roadmap',    'View roadmap',        'Can access the Roadmap tab',                           'Planning',  true,  true),
  ('manage_members',  'Manage members',      'Can invite and remove workspace members',              'Admin',     false, false),
  ('manage_settings', 'Manage settings',     'Can change workspace settings',                        'Admin',     false, false),
  ('manage_api_keys', 'Manage API keys',     'Can create and revoke API keys',                       'Admin',     false, false),
  ('view_reports',    'View reports',        'Can access the Reports tab',                           'Reporting', true,  true),
  ('export_data',     'Export data',         'Can export issues and reports as CSV',                 'Reporting', false, false)
on conflict (key) do nothing;

insert into public.schema_migrations (filename)
values ('0100_permission_registry.sql')
on conflict do nothing;
