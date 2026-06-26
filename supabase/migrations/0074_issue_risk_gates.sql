-- Migration 0074: Issue Risk Gates
-- Stores PR Impact prediction results and approval workflow for High/Critical risk issues.
-- Run in Supabase SQL editor.

CREATE TABLE issue_risk_gates (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  issue_id       uuid        NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  state          text        NOT NULL DEFAULT 'open'
                             CHECK (state IN ('open', 'approved', 'denied')),
  risk_level     text        NOT NULL
                             CHECK (risk_level IN ('high', 'critical')),
  prediction_json jsonb      NOT NULL DEFAULT '{}',
  triggered_by   uuid        REFERENCES auth.users(id),
  reviewed_by    uuid        REFERENCES auth.users(id),
  review_reason  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  reviewed_at    timestamptz
);

CREATE INDEX issue_risk_gates_issue_id_idx  ON issue_risk_gates (issue_id);
CREATE INDEX issue_risk_gates_tenant_id_idx ON issue_risk_gates (tenant_id);
CREATE INDEX issue_risk_gates_state_idx     ON issue_risk_gates (tenant_id, state) WHERE state = 'open';

ALTER TABLE issue_risk_gates ENABLE ROW LEVEL SECURITY;

-- Tenant members can read gates for their tenant
CREATE POLICY "risk_gates_tenant_read" ON issue_risk_gates
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

-- All writes go through service-role client (tenant_id injected in code)
