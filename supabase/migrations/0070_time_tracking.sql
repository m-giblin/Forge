-- Time tracking: log work hours against issues.
CREATE TABLE IF NOT EXISTS issue_time_logs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  issue_id    uuid not null references issues(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  minutes     integer not null check (minutes > 0),
  note        text,
  logged_at   timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS issue_time_logs_tenant_idx ON issue_time_logs(tenant_id);
CREATE INDEX IF NOT EXISTS issue_time_logs_issue_idx  ON issue_time_logs(issue_id);

-- RLS: members can see all logs in their tenant; can only insert/delete their own.
ALTER TABLE issue_time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read time logs" ON issue_time_logs
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "members log time" ON issue_time_logs
  FOR INSERT WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    AND tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "members delete own logs" ON issue_time_logs
  FOR DELETE USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
  );
