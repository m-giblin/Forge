-- Scheduled report delivery (premium tier)
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  report_type   TEXT NOT NULL DEFAULT 'custom' CHECK (report_type IN ('custom', 'velocity', 'aging', 'cycle_time')),
  config        JSONB NOT NULL DEFAULT '{}',
  cadence       TEXT NOT NULL DEFAULT 'weekly' CHECK (cadence IN ('daily', 'weekly', 'biweekly', 'monthly')),
  day_of_week   INT  DEFAULT 5 CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 5=Fri
  recipients    TEXT[] NOT NULL DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_sent_at  TIMESTAMPTZ,
  next_send_at  TIMESTAMPTZ,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

-- Members of the tenant can read; only owners/admins write (enforced in API layer)
CREATE POLICY "scheduled_reports_tenant_isolation" ON scheduled_reports
  USING (
    tenant_id IN (
      SELECT tenant_id FROM memberships WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_scheduled_reports_tenant ON scheduled_reports(tenant_id);
CREATE INDEX idx_scheduled_reports_next_send ON scheduled_reports(next_send_at) WHERE is_active = TRUE;
