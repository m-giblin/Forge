-- Migration 0075: Store latest PR Impact prediction on the issue
-- Allows dashboard and ticket UI to surface risk level without querying
-- the full risk gates history. Updated on every prediction run.

ALTER TABLE issues ADD COLUMN IF NOT EXISTS latest_pr_impact jsonb;
