-- =============================================================================
-- 0087_issue_assignees.sql
-- Multiple assignees per issue.
--
-- Model: issues.assignee_id stays as the canonical PRIMARY assignee (DRI).
-- This join table holds the FULL set of assignees, including the primary.
-- All existing read sites keep reading issues.assignee_id unchanged; new
-- surfaces (issue detail, board card, grid) read the full set from here.
-- FK to users preserves the tenant member-verification the isolation model relies on.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.issue_assignees (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  issue_id    uuid NOT NULL REFERENCES public.issues(id)  ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users(id)   ON DELETE CASCADE,
  added_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issue_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_issue_assignees_tenant
  ON public.issue_assignees (tenant_id);
CREATE INDEX IF NOT EXISTS idx_issue_assignees_issue
  ON public.issue_assignees (issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_assignees_user
  ON public.issue_assignees (user_id);

ALTER TABLE public.issue_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read issue assignees"
  ON public.issue_assignees FOR SELECT
  USING (tenant_id IN (SELECT public.current_tenant_ids()));

CREATE POLICY "members manage issue assignees"
  ON public.issue_assignees FOR ALL
  USING (tenant_id IN (SELECT public.current_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.current_tenant_ids()));

-- Backfill: seed the set from the existing primary assignee so full-set reads
-- are consistent with the board/list from day one.
INSERT INTO public.issue_assignees (tenant_id, issue_id, user_id)
SELECT tenant_id, id, assignee_id
FROM public.issues
WHERE assignee_id IS NOT NULL
ON CONFLICT (issue_id, user_id) DO NOTHING;

INSERT INTO public.schema_migrations (filename)
VALUES ('0087_issue_assignees.sql')
ON CONFLICT DO NOTHING;
