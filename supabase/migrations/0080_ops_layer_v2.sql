-- =============================================================================
-- 0080_ops_layer_v2.sql
-- Ops Layer — Phase 2 additions
--
-- Adds: recurring time entries, budget alert threshold per project,
--       time-off balance tracking per user, sprint velocity cache.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add budget_alert_threshold_pct to projects
--    (null = no alert; 75 = alert at 75% burn)
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS budget_alert_threshold_pct integer
    CHECK (budget_alert_threshold_pct BETWEEN 1 AND 100);

-- ---------------------------------------------------------------------------
-- 2. recurring_time_entries — "log this every day/week" template
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_time_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  issue_id     uuid NOT NULL REFERENCES public.issues(id)   ON DELETE CASCADE,
  minutes      integer NOT NULL CHECK (minutes > 0),
  note         text,
  billable     bool NOT NULL DEFAULT false,
  tag          text,
  frequency    text NOT NULL DEFAULT 'daily'
                 CHECK (frequency IN ('daily','weekly')),
  days_of_week int[] NOT NULL DEFAULT '{1,2,3,4,5}', -- 0=Sun…6=Sat
  active       bool NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_time_entries_tenant
  ON public.recurring_time_entries (tenant_id);
CREATE INDEX IF NOT EXISTS idx_recurring_time_entries_user
  ON public.recurring_time_entries (user_id);

ALTER TABLE public.recurring_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own recurring entries"
  ON public.recurring_time_entries
  FOR ALL
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. time_off_balances — per-user PTO balance tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.time_off_balances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id)   ON DELETE CASCADE,
  year            integer NOT NULL,
  pto_accrued     numeric(6,2) NOT NULL DEFAULT 0,
  pto_used        numeric(6,2) NOT NULL DEFAULT 0,
  sick_used       numeric(6,2) NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, year)
);

CREATE INDEX IF NOT EXISTS idx_time_off_balances_tenant
  ON public.time_off_balances (tenant_id);

ALTER TABLE public.time_off_balances ENABLE ROW LEVEL SECURITY;

-- Members see their own; admins see all
CREATE POLICY "own or admin balance"
  ON public.time_off_balances
  FOR SELECT
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
    OR public.has_tenant_role(tenant_id, ARRAY['owner','admin']::membership_role[])
  );

CREATE POLICY "admins manage balances"
  ON public.time_off_balances
  FOR ALL
  USING (
    public.has_tenant_role(tenant_id, ARRAY['owner','admin']::membership_role[])
  )
  WITH CHECK (
    public.has_tenant_role(tenant_id, ARRAY['owner','admin']::membership_role[])
  );

-- ---------------------------------------------------------------------------
-- 4. sprint_velocity — snapshot per sprint for velocity charts
--    Populated on sprint close; can be recomputed from issues + time logs.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sprint_velocity (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  project_id         uuid NOT NULL REFERENCES public.projects(id)  ON DELETE CASCADE,
  sprint_id          uuid NOT NULL REFERENCES public.sprints(id)   ON DELETE CASCADE,
  sprint_name        text NOT NULL,
  sprint_end_date    date,
  planned_points     integer NOT NULL DEFAULT 0,
  completed_points   integer NOT NULL DEFAULT 0,
  total_issues       integer NOT NULL DEFAULT 0,
  completed_issues   integer NOT NULL DEFAULT 0,
  logged_minutes     integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sprint_id)
);

CREATE INDEX IF NOT EXISTS idx_sprint_velocity_tenant
  ON public.sprint_velocity (tenant_id, project_id);

ALTER TABLE public.sprint_velocity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read sprint velocity"
  ON public.sprint_velocity
  FOR SELECT
  USING (
    tenant_id IN (SELECT public.current_tenant_ids())
  );

CREATE POLICY "admins manage sprint velocity"
  ON public.sprint_velocity
  FOR ALL
  USING (
    public.has_tenant_role(tenant_id, ARRAY['owner','admin','member']::membership_role[])
  )
  WITH CHECK (
    public.has_tenant_role(tenant_id, ARRAY['owner','admin','member']::membership_role[])
  );

-- ---------------------------------------------------------------------------
-- 5. Schema migrations record
-- ---------------------------------------------------------------------------
INSERT INTO public.schema_migrations (filename)
VALUES ('0080_ops_layer_v2.sql')
ON CONFLICT DO NOTHING;
