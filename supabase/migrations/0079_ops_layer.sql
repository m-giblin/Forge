-- =============================================================================
-- 0079_ops_layer.sql
-- Ops Layer — Time & Capacity module
--
-- Adds: live timers, timesheet submissions/approvals, member availability,
--       billing rates, internal cost rates, time-off requests.
-- Also backfills issue_time_logs with billable + tag columns, and adds
-- time_estimate_minutes to issues.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Alter issue_time_logs: add billable and tag
-- ---------------------------------------------------------------------------
ALTER TABLE public.issue_time_logs
  ADD COLUMN IF NOT EXISTS billable bool NOT NULL DEFAULT false;

ALTER TABLE public.issue_time_logs
  ADD COLUMN IF NOT EXISTS tag text;

-- ---------------------------------------------------------------------------
-- 2. Add time_estimate_minutes to issues
-- ---------------------------------------------------------------------------
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS time_estimate_minutes integer CHECK (time_estimate_minutes > 0);

-- ---------------------------------------------------------------------------
-- 3. active_timers — one running timer per user per workspace
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.active_timers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users(id)   ON DELETE CASCADE,
  issue_id    uuid NOT NULL REFERENCES public.issues(id)  ON DELETE CASCADE,
  started_at  timestamptz NOT NULL DEFAULT now(),

  -- only one active timer per user per workspace
  UNIQUE (tenant_id, user_id)
);

ALTER TABLE public.active_timers ENABLE ROW LEVEL SECURITY;

-- members can read their own running timer
CREATE POLICY "read own timer"
  ON public.active_timers
  FOR SELECT
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- members can start / stop (insert / delete) and update their own timer
CREATE POLICY "manage own timer"
  ON public.active_timers
  FOR ALL
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 4. member_availability — capacity declaration per user per workspace
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.member_availability (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES public.users(id)   ON DELETE CASCADE,
  hours_per_week numeric(5,2) NOT NULL DEFAULT 40,
  work_days      int[]        NOT NULL DEFAULT '{1,2,3,4,5}', -- 1=Mon … 5=Fri
  updated_at     timestamptz  NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, user_id)
);

ALTER TABLE public.member_availability ENABLE ROW LEVEL SECURITY;

-- any tenant member can read all availability records in their workspace
CREATE POLICY "members read availability"
  ON public.member_availability
  FOR SELECT
  USING (
    tenant_id IN (SELECT public.current_tenant_ids())
  );

-- each user manages only their own availability row
CREATE POLICY "own availability manage"
  ON public.member_availability
  FOR ALL
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 5. billing_rates — external billing rate per user / role / project (premium)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_rates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL  REFERENCES public.tenants(id)   ON DELETE CASCADE,
  -- null = role-based rate (not tied to a specific person)
  user_id        uuid           REFERENCES public.users(id)     ON DELETE CASCADE,
  -- null = global rate (not tied to a specific project)
  project_id     uuid           REFERENCES public.projects(id)  ON DELETE CASCADE,
  role_name      text,          -- e.g. 'engineer', 'designer'
  rate_cents     integer NOT NULL CHECK (rate_cents >= 0),
  currency       char(3)  NOT NULL DEFAULT 'USD',
  effective_from date     NOT NULL DEFAULT CURRENT_DATE,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_rates ENABLE ROW LEVEL SECURITY;

-- owners and admins can create / edit / delete billing rates
CREATE POLICY "admins manage billing rates"
  ON public.billing_rates
  FOR ALL
  USING (
    public.has_tenant_role(tenant_id, ARRAY['owner','admin']::membership_role[])
  )
  WITH CHECK (
    public.has_tenant_role(tenant_id, ARRAY['owner','admin']::membership_role[])
  );

-- all workspace members can read rates (needed for time-cost calculations)
CREATE POLICY "members read rates"
  ON public.billing_rates
  FOR SELECT
  USING (
    tenant_id IN (SELECT public.current_tenant_ids())
  );

-- ---------------------------------------------------------------------------
-- 6. cost_rates — internal hourly cost per person / role (premium, admin-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cost_rates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- null = role-based cost
  user_id        uuid           REFERENCES public.users(id)  ON DELETE CASCADE,
  role_name      text,
  cost_cents     integer NOT NULL CHECK (cost_cents >= 0), -- hourly internal cost
  currency       char(3)  NOT NULL DEFAULT 'USD',
  effective_from date     NOT NULL DEFAULT CURRENT_DATE,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cost_rates ENABLE ROW LEVEL SECURITY;

-- cost data is sensitive — owners/admins only for all operations
CREATE POLICY "admins only cost rates"
  ON public.cost_rates
  FOR ALL
  USING (
    public.has_tenant_role(tenant_id, ARRAY['owner','admin']::membership_role[])
  )
  WITH CHECK (
    public.has_tenant_role(tenant_id, ARRAY['owner','admin']::membership_role[])
  );

-- ---------------------------------------------------------------------------
-- 7. time_off_requests — PTO / sick / holiday requests with approval flow
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.time_off_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users(id)   ON DELETE CASCADE,
  type         text NOT NULL DEFAULT 'pto'
                 CHECK (type IN ('pto','sick','holiday','other')),
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  days_count   numeric(5,2) NOT NULL DEFAULT 1,
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected')),
  notes        text,
  reviewed_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

-- members see their own requests; admins/owners see all in the workspace
CREATE POLICY "members read own + admins read all"
  ON public.time_off_requests
  FOR SELECT
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
    OR public.has_tenant_role(tenant_id, ARRAY['owner','admin']::membership_role[])
  );

-- members submit requests for themselves only
CREATE POLICY "create own"
  ON public.time_off_requests
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- admins/owners approve or reject requests
CREATE POLICY "admins approve"
  ON public.time_off_requests
  FOR UPDATE
  USING (
    public.has_tenant_role(tenant_id, ARRAY['owner','admin']::membership_role[])
  )
  WITH CHECK (
    public.has_tenant_role(tenant_id, ARRAY['owner','admin']::membership_role[])
  );

-- ---------------------------------------------------------------------------
-- 8. timesheet_submissions — weekly time approval flow (premium)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.timesheet_submissions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES public.users(id)   ON DELETE CASCADE,
  week_start     date NOT NULL, -- always a Monday
  status         text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','submitted','approved','rejected')),
  submitted_at   timestamptz,
  reviewed_by    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at    timestamptz,
  reviewer_notes text,
  total_minutes  integer DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, user_id, week_start)
);

ALTER TABLE public.timesheet_submissions ENABLE ROW LEVEL SECURITY;

-- each user can read, create, and update their own submissions
CREATE POLICY "own submissions"
  ON public.timesheet_submissions
  FOR ALL
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- admins/owners can read all submissions in the workspace
CREATE POLICY "admins read all submissions"
  ON public.timesheet_submissions
  FOR SELECT
  USING (
    public.has_tenant_role(tenant_id, ARRAY['owner','admin']::membership_role[])
  );

-- admins/owners can update (approve/reject) any submission
CREATE POLICY "admins review"
  ON public.timesheet_submissions
  FOR UPDATE
  USING (
    public.has_tenant_role(tenant_id, ARRAY['owner','admin']::membership_role[])
  )
  WITH CHECK (
    public.has_tenant_role(tenant_id, ARRAY['owner','admin']::membership_role[])
  );

-- ---------------------------------------------------------------------------
-- 9. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_active_timers_tenant_id
  ON public.active_timers (tenant_id);

CREATE INDEX IF NOT EXISTS idx_active_timers_user_id
  ON public.active_timers (user_id);

CREATE INDEX IF NOT EXISTS idx_member_availability_tenant_id
  ON public.member_availability (tenant_id);

CREATE INDEX IF NOT EXISTS idx_billing_rates_tenant_id
  ON public.billing_rates (tenant_id);

CREATE INDEX IF NOT EXISTS idx_billing_rates_user_id
  ON public.billing_rates (user_id);

CREATE INDEX IF NOT EXISTS idx_cost_rates_tenant_id
  ON public.cost_rates (tenant_id);

CREATE INDEX IF NOT EXISTS idx_time_off_requests_tenant_id
  ON public.time_off_requests (tenant_id);

CREATE INDEX IF NOT EXISTS idx_time_off_requests_user_id
  ON public.time_off_requests (user_id);

CREATE INDEX IF NOT EXISTS idx_timesheet_submissions_tenant_id
  ON public.timesheet_submissions (tenant_id);

CREATE INDEX IF NOT EXISTS idx_timesheet_submissions_user_id
  ON public.timesheet_submissions (user_id);

-- ---------------------------------------------------------------------------
-- 10. Feature flags
-- ---------------------------------------------------------------------------
INSERT INTO public.feature_flags (key, label, description, enabled)
VALUES
  (
    'ops_layer',
    'Ops Layer — Time & Capacity',
    'Time tracking (live timer, timesheet), workload view, sprint capacity, budget burn. Pro tier.',
    true
  ),
  (
    'ops_layer_premium',
    'Ops Layer Premium',
    'Timesheet approvals, billing rates, internal cost rates, time off management, utilization analytics. Premium tier.',
    false
  )
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 11. Schema migrations record
-- ---------------------------------------------------------------------------
INSERT INTO public.schema_migrations (filename)
VALUES ('0079_ops_layer.sql')
ON CONFLICT DO NOTHING;
