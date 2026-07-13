-- Migration 0108: graduated tenant-suspension SDK intake + inactive-project fallback
--
-- Problem: an active tenant's forge-sdk.js can file into a project that's
-- since been archived/closed/on_hold (silent black hole), and a SUSPENDED
-- tenant's API key keeps authenticating forever (authenticateApiKey never
-- checked tenants.status) — also a silent black hole, just for a different
-- reason. Neither case ever error'd; both just quietly accepted the ticket
-- into a place nobody was looking.
--
-- Fix: a graduated grace period after suspension (full alert for the first
-- N days, a "this is about to stop" warning for the next M days, then a hard
-- reject), plus a per-tenant fallback project that any of these paths route
-- into instead of a closed/archived one — so a real production error never
-- just vanishes, it lands somewhere a human will see it.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_system_fallback boolean NOT NULL DEFAULT false;

-- Only one fallback project per tenant — it's an implementation detail, not
-- something an admin creates/chooses, so nothing should be able to make a second.
CREATE UNIQUE INDEX IF NOT EXISTS projects_one_fallback_per_tenant
  ON projects (tenant_id) WHERE is_system_fallback;

-- Super-admin-configurable thresholds (platform_settings is the existing
-- global, non-tenant-scoped KV store — same table already used for the
-- Resend API key and the support-ticket "stalled after N days" setting).
INSERT INTO platform_settings (key, value) VALUES
  ('sdk_suspension_notify_days', '30'),
  ('sdk_suspension_grace_days', '60')
ON CONFLICT (key) DO NOTHING;
