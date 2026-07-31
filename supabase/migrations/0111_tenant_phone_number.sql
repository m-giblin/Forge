-- Migration 0111: tenant contact phone number
--
-- Onboarding gap: neither the self-serve signup form nor the admin-side
-- provisioning form captured a phone number for the new workspace, even
-- though it's a non-negotiable onboarding field per product decision
-- (company name is already covered by tenants.name, and the breakglass
-- owner's name/email are already covered by the users/memberships flow —
-- phone number was the one genuinely missing piece).

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone_number text;

INSERT INTO public.schema_migrations (filename) VALUES ('0111_tenant_phone_number.sql')
ON CONFLICT DO NOTHING;
