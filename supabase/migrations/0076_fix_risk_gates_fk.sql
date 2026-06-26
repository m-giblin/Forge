-- Migration 0076: Fix issue_risk_gates FK references
-- triggered_by and reviewed_by were referencing auth.users(id) but the app
-- stores app-level user IDs (users.id), not auth UUIDs. Drop the FKs and
-- let them be plain UUID columns — the audit trail lives in system comments.

ALTER TABLE issue_risk_gates
  DROP CONSTRAINT IF EXISTS issue_risk_gates_triggered_by_fkey,
  DROP CONSTRAINT IF EXISTS issue_risk_gates_reviewed_by_fkey;
