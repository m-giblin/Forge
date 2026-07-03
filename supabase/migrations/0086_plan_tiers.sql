-- 0086_plan_tiers.sql
-- Introduces DB-driven plan tiers and a complete, unified feature flag set.
--
-- New tables:
--   plan_tiers          — Basic, Premium, Pro, Enterprise definitions (active/inactive)
--   plan_tier_features  — which features are included per tier (the editable matrix)
--   tenant_notifications — in-app banners when a tenant's plan gains a new feature
--   tenant_self_overrides — tenant-admin choices (disable features within their plan)
--
-- Existing tables updated:
--   feature_flags — upsert all 14 gated feature keys
--   tenant_feature_overrides — now also seeded for ai_sprint on premium tenants
--
-- Existing tenants are unaffected: all current overrides stay, ai_sprint is seeded
-- for anyone already on premium so the flag change is transparent.

-- ── 1. Ensure all 14 feature flag rows exist ────────────────────────────────
insert into public.feature_flags (key, label, description, enabled) values
  ('think_tank',        'Think Tank',               'AI-powered idea capture and decision tracking',                         false),
  ('dashboards',        'Mission Control',           'Cross-project analytics and Morning Briefing dashboard',               false),
  ('project_portal',    'Project Portal',            'Project timeline, health scores, costs and sign-offs',                 false),
  ('ops_layer',         'My Time (Timesheets)',       'Personal timesheet tracking and time logging',                         false),
  ('ops_layer_premium', 'Timesheet Premium',         'Timesheet approvals, time-off management and billing cost rates',      false),
  ('ai_sprint',         'AI Sprint Intelligence',    'Automated velocity, cycle time and team-load analysis per sprint',     false),
  ('advanced_reports',  'Advanced Reports',          'Cycle Time, Issue Aging and Scheduled Reports',                        false),
  ('job_titles',        'Job Titles',               'Job title field on team member profiles',                              false),
  ('pdf_exports',       'PDF & Excel Exports',       'Export issues, reports and project data to PDF and Excel',            false),
  ('rbac',              'Custom Roles',              'Define custom workspace roles with granular permissions',              false),
  ('roadmap',           'Visual Roadmap',            'Drag-and-drop roadmap planning board',                                false),
  ('sso',               'SSO / SAML',               'Single Sign-On via SAML 2.0 or OIDC provider',                       false),
  ('advanced_ai',       'Advanced AI',               'Custom AI models, extended context and priority inference queue',      false),
  ('webhooks',          'Webhooks & Integrations',   'Outbound webhooks and third-party integration connectors',            false)
on conflict (key) do update set
  label       = excluded.label,
  description = excluded.description;

-- ── 2. plan_tiers ────────────────────────────────────────────────────────────
create table if not exists public.plan_tiers (
  key             text primary key,
  label           text not null,
  description     text,
  monthly_cents   integer,           -- null = contact sales / coming soon
  is_active       boolean not null default true,
  display_order   integer not null default 0,
  updated_at      timestamptz not null default now()
);

alter table public.plan_tiers enable row level security;
-- Service-role only.

create or replace trigger plan_tiers_updated_at
  before update on public.plan_tiers
  for each row execute procedure public.set_updated_at();

insert into public.plan_tiers (key, label, description, monthly_cents, is_active, display_order) values
  ('basic',      'Basic',      'Core kanban and sprint tools for small teams',             900,  true,  1),
  ('premium',    'Premium',    'Full feature suite for growing engineering teams',         1900, true,  2),
  ('pro',        'Pro',        'Enterprise controls, SSO and advanced AI',                null, false, 3),
  ('enterprise', 'Enterprise', 'On-premise, custom models and volume pricing',            null, false, 4)
on conflict (key) do nothing;

-- ── 3. plan_tier_features ────────────────────────────────────────────────────
create table if not exists public.plan_tier_features (
  plan_key    text not null references public.plan_tiers(key) on delete cascade,
  feature_key text not null references public.feature_flags(key) on delete cascade,
  included    boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (plan_key, feature_key)
);

alter table public.plan_tier_features enable row level security;
-- Service-role only.

create or replace trigger plan_tier_features_updated_at
  before update on public.plan_tier_features
  for each row execute procedure public.set_updated_at();

-- Seed the feature matrix
insert into public.plan_tier_features (plan_key, feature_key, included) values
  -- Basic: no gated features (table stakes kanban/sprints/burndown are hardcoded)
  ('basic',      'think_tank',        false),
  ('basic',      'dashboards',        false),
  ('basic',      'project_portal',    false),
  ('basic',      'ops_layer',         false),
  ('basic',      'ops_layer_premium', false),
  ('basic',      'ai_sprint',         false),
  ('basic',      'advanced_reports',  false),
  ('basic',      'job_titles',        false),
  ('basic',      'pdf_exports',       false),
  ('basic',      'rbac',              false),
  ('basic',      'roadmap',           false),
  ('basic',      'sso',               false),
  ('basic',      'advanced_ai',       false),
  ('basic',      'webhooks',          false),
  -- Premium: everything except rbac, roadmap, sso, advanced_ai, webhooks
  ('premium',    'think_tank',        true),
  ('premium',    'dashboards',        true),
  ('premium',    'project_portal',    true),
  ('premium',    'ops_layer',         true),
  ('premium',    'ops_layer_premium', true),
  ('premium',    'ai_sprint',         true),
  ('premium',    'advanced_reports',  true),
  ('premium',    'job_titles',        true),
  ('premium',    'pdf_exports',       true),
  ('premium',    'rbac',              false),
  ('premium',    'roadmap',           false),
  ('premium',    'sso',               false),
  ('premium',    'advanced_ai',       false),
  ('premium',    'webhooks',          false),
  -- Pro: everything except advanced_ai, webhooks
  ('pro',        'think_tank',        true),
  ('pro',        'dashboards',        true),
  ('pro',        'project_portal',    true),
  ('pro',        'ops_layer',         true),
  ('pro',        'ops_layer_premium', true),
  ('pro',        'ai_sprint',         true),
  ('pro',        'advanced_reports',  true),
  ('pro',        'job_titles',        true),
  ('pro',        'pdf_exports',       true),
  ('pro',        'rbac',              true),
  ('pro',        'roadmap',           true),
  ('pro',        'sso',               true),
  ('pro',        'advanced_ai',       false),
  ('pro',        'webhooks',          false),
  -- Enterprise: everything
  ('enterprise', 'think_tank',        true),
  ('enterprise', 'dashboards',        true),
  ('enterprise', 'project_portal',    true),
  ('enterprise', 'ops_layer',         true),
  ('enterprise', 'ops_layer_premium', true),
  ('enterprise', 'ai_sprint',         true),
  ('enterprise', 'advanced_reports',  true),
  ('enterprise', 'job_titles',        true),
  ('enterprise', 'pdf_exports',       true),
  ('enterprise', 'rbac',              true),
  ('enterprise', 'roadmap',           true),
  ('enterprise', 'sso',               true),
  ('enterprise', 'advanced_ai',       true),
  ('enterprise', 'webhooks',          true)
on conflict (plan_key, feature_key) do nothing;

-- ── 4. tenant_self_overrides ─────────────────────────────────────────────────
-- Tenant admins can disable features within their plan. They can never enable
-- features outside their plan via this table (enforced at the app layer).
create table if not exists public.tenant_self_overrides (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  feature_key text not null references public.feature_flags(key) on delete cascade,
  enabled     boolean not null,   -- will always be false (disable-only), stored for auditability
  updated_by  uuid references public.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, feature_key)
);

alter table public.tenant_self_overrides enable row level security;

-- Tenant owners/admins can read and write their own workspace's self-overrides.
create policy tenant_self_overrides_select on public.tenant_self_overrides
  for select using (
    tenant_id in (select public.current_tenant_ids())
  );

create policy tenant_self_overrides_write on public.tenant_self_overrides
  for all using (
    public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
  );

create or replace trigger tenant_self_overrides_updated_at
  before update on public.tenant_self_overrides
  for each row execute procedure public.set_updated_at();

-- ── 5. tenant_notifications ──────────────────────────────────────────────────
create table if not exists public.tenant_notifications (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  type        text not null default 'plan_feature_added',
  title       text not null,
  body        text,
  feature_key text references public.feature_flags(key) on delete set null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index idx_tenant_notifications_tenant on public.tenant_notifications(tenant_id, read_at);

alter table public.tenant_notifications enable row level security;

-- Members can read their tenant's notifications; owners/admins can mark read.
create policy tenant_notifications_select on public.tenant_notifications
  for select using (tenant_id in (select public.current_tenant_ids()));

create policy tenant_notifications_update on public.tenant_notifications
  for update using (
    public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
  );

-- ── 6. Seed ai_sprint override for existing premium/pro/enterprise tenants ───
-- These tenants were previously gated by subscription_tier check. Now that
-- ai_sprint is a proper flag, give them the override so nothing breaks.
insert into public.tenant_feature_overrides (tenant_id, key, enabled)
  select id, 'ai_sprint', true
  from public.tenants
  where plan in ('premium', 'pro', 'enterprise')
on conflict (tenant_id, key) do nothing;

-- ── 7. Seed all other premium flags for existing premium tenants ─────────────
-- Existing premium tenants should already have overrides from migration 0032,
-- but fill any gaps for the new flags we're adding now.
insert into public.tenant_feature_overrides (tenant_id, key, enabled)
  select t.id, f.key, true
  from public.tenants t
  cross join public.feature_flags f
  where t.plan in ('premium', 'pro', 'enterprise')
    and f.key in ('ops_layer','ops_layer_premium','ai_sprint','advanced_reports','job_titles','pdf_exports')
on conflict (tenant_id, key) do nothing;

insert into public.schema_migrations (filename, notes)
  values ('0086_plan_tiers.sql', 'Plan tiers, plan_tier_features matrix, tenant_self_overrides, tenant_notifications, 14 feature flags')
  on conflict (filename) do nothing;
