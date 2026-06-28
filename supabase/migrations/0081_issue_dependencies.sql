-- =============================================================================
-- 0081_issue_dependencies.sql
-- Issue dependency links — "A blocks B", "A relates to B"
-- Used by the Timeline view for dependency arrows and conflict detection.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.issue_dependencies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  from_issue_id  uuid NOT NULL REFERENCES public.issues(id)   ON DELETE CASCADE,
  to_issue_id    uuid NOT NULL REFERENCES public.issues(id)   ON DELETE CASCADE,
  type           text NOT NULL DEFAULT 'blocks'
                   CHECK (type IN ('blocks', 'relates_to')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_issue_id, to_issue_id, type)
);

CREATE INDEX IF NOT EXISTS idx_issue_deps_tenant
  ON public.issue_dependencies (tenant_id);
CREATE INDEX IF NOT EXISTS idx_issue_deps_from
  ON public.issue_dependencies (from_issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_deps_to
  ON public.issue_dependencies (to_issue_id);

ALTER TABLE public.issue_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read deps"
  ON public.issue_dependencies FOR SELECT
  USING (tenant_id IN (SELECT public.current_tenant_ids()));

CREATE POLICY "members manage deps"
  ON public.issue_dependencies FOR ALL
  USING (tenant_id IN (SELECT public.current_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.current_tenant_ids()));

INSERT INTO public.schema_migrations (filename)
VALUES ('0081_issue_dependencies.sql')
ON CONFLICT DO NOTHING;
