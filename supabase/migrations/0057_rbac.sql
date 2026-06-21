-- Custom roles for RBAC (enterprise tier, per-tenant feature flag: rbac)
-- Owners and Admins are always full-access. Custom roles sit at or below Member level
-- and define a named permission set that overrides the generic member/viewer defaults.

CREATE TABLE IF NOT EXISTS public.custom_roles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  color       TEXT        NOT NULL DEFAULT 'indigo',
  permissions JSONB       NOT NULL DEFAULT '{}',
  is_system   BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

-- Members of the tenant can read its custom roles (needed to show role name on UI)
CREATE POLICY "tenant_members_read_custom_roles"
  ON public.custom_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.tenant_id = custom_roles.tenant_id
        AND memberships.user_id = auth.uid()
    )
  );

-- All writes go through the service-role client (no user-level INSERT/UPDATE/DELETE)

-- Attach custom_role_id to memberships
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- Feature flag: off globally, super-admin enables per-tenant via tenant_feature_overrides
INSERT INTO public.feature_flags (key, label, enabled, description)
VALUES (
  'rbac',
  'Custom Roles (RBAC)',
  false,
  'Enterprise: named custom roles with granular permission sets. Enable per-tenant only via super-admin — not a platform-wide toggle.'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.schema_migrations (filename)
VALUES ('0057_rbac.sql')
ON CONFLICT DO NOTHING;
