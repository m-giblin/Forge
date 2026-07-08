-- 0097: Stripe billing scaffolding + reconcile the tenants.plan / subscription_tier split.
--
-- Two independent tier columns existed on tenants: the original `plan` (default
-- 'free', never updated by signup or billing) and `subscription_tier` (default
-- 'basic', set correctly by signup — trialing/premium). Because the feature-flag
-- entitlement resolver reads `plan`, and `plan` was stuck at 'free' for every real
-- tenant, plan-tier gating has been silently bypassed since migration 0085/0086
-- shipped. This backfills `plan` from `subscription_tier` and keeps them in sync
-- going forward from application code (signup, Stripe webhook).

update public.tenants
set plan = subscription_tier
where plan is distinct from subscription_tier;

-- Stripe Price ID per plan tier — filled in via /admin/settings/billing once
-- Stripe products/prices are created. Null = no live price yet (checkout falls
-- back to the existing "request activation" flow).
alter table public.plan_tiers
  add column if not exists stripe_price_id text;

-- Stripe Customer ID per tenant — set on first checkout session / webhook event.
alter table public.tenants
  add column if not exists stripe_customer_id text;

insert into public.schema_migrations (filename)
values ('0097_stripe_billing.sql')
on conflict do nothing;
