-- Tenant-level permission overrides for member/viewer roles.
-- Stored as a flat JSON object: { "viewer.create_issue": true, "member.delete_issue": true, ... }
-- Absent keys fall back to the hardcoded defaults in lib/permissions.ts.
alter table tenants
  add column if not exists permission_overrides jsonb not null default '{}'::jsonb;
