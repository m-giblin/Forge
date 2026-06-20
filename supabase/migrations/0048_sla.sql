-- SLA policy engine: policies + event log
create table if not exists sla_policies (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  conditions  jsonb not null default '{}',  -- { priority: ["critical","high"] }
  tiers       jsonb not null default '[]',  -- [{ type:"response"|"resolution", hours:number, action:"notify"|"reassign", target_label:string }]
  enabled     boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists sla_policies_tenant_idx on sla_policies(tenant_id);

alter table sla_policies enable row level security;
create policy "admin manage sla_policies" on sla_policies
  using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = auth.uid() and role in ('owner','admin')
    )
  )
  with check (
    tenant_id in (
      select tenant_id from memberships
      where user_id = auth.uid() and role in ('owner','admin')
    )
  );

-- Allow members to read policies (needed for timer chip)
create policy "members read sla_policies" on sla_policies
  for select
  using (
    tenant_id in (
      select tenant_id from memberships where user_id = auth.uid()
    )
  );

create table if not exists sla_events (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  issue_id      uuid not null references issues(id) on delete cascade,
  policy_id     uuid not null references sla_policies(id) on delete cascade,
  event_type    text not null,  -- 'response_breach' | 'resolution_breach' | 'response_warning' | 'resolution_warning'
  tier_hours    int,
  triggered_at  timestamptz not null default now()
);

create index if not exists sla_events_issue_idx on sla_events(issue_id);
create index if not exists sla_events_tenant_idx on sla_events(tenant_id);

alter table sla_events enable row level security;
create policy "members read sla_events" on sla_events
  for select
  using (
    tenant_id in (
      select tenant_id from memberships where user_id = auth.uid()
    )
  );
create policy "service role manage sla_events" on sla_events
  using (true)
  with check (true);
