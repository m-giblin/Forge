-- 0088_whiteboards.sql
-- Collaborative whiteboards per project (tldraw-compatible JSONB state)

CREATE TABLE IF NOT EXISTS project_whiteboards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Whiteboard',
  state       JSONB,                    -- tldraw TLRecord snapshot
  thumbnail   TEXT,                    -- base64 preview (set by client on save)
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_whiteboards_project_idx ON project_whiteboards(project_id);
CREATE INDEX IF NOT EXISTS project_whiteboards_tenant_idx  ON project_whiteboards(tenant_id);

CREATE OR REPLACE FUNCTION update_project_whiteboards_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER project_whiteboards_updated_at
  BEFORE UPDATE ON project_whiteboards
  FOR EACH ROW EXECUTE FUNCTION update_project_whiteboards_updated_at();

ALTER TABLE project_whiteboards ENABLE ROW LEVEL SECURITY;

-- Members of the tenant can read whiteboards in their projects
CREATE POLICY "members_read_whiteboards" ON project_whiteboards
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- Members can create and update whiteboards (write access = any member)
CREATE POLICY "members_write_whiteboards" ON project_whiteboards
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE u.auth_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE u.auth_id = auth.uid()
    )
  );
