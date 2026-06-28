-- Trial & billing fields on tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS trial_started_at    timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at       timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'free'
    CHECK (subscription_status IN ('free','trialing','active','expired','cancelled')),
  ADD COLUMN IF NOT EXISTS subscription_tier   text NOT NULL DEFAULT 'basic'
    CHECK (subscription_tier IN ('basic','premium','pro','enterprise')),
  ADD COLUMN IF NOT EXISTS subscription_seats  integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS billing_email       text;

-- Track which lifecycle emails have been sent per tenant
CREATE TABLE IF NOT EXISTS public.trial_lifecycle_emails (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email_type     text        NOT NULL
    CHECK (email_type IN ('day_3_nudge','day_7_midpoint','day_13_urgency','expired')),
  recipient_email text       NOT NULL,
  sent_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email_type)
);

-- Billing requests (Stripe-ready; filled when Stripe is wired up)
CREATE TABLE IF NOT EXISTS public.billing_requests (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tier                   text        NOT NULL,
  seats                  integer     NOT NULL DEFAULT 1,
  status                 text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','active','failed','cancelled')),
  stripe_session_id      text,
  stripe_subscription_id text,
  stripe_price_id        text,
  amount_cents           integer,
  currency               text        NOT NULL DEFAULT 'usd',
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- RLS: tenants can read their own billing requests (admins only write via service role)
ALTER TABLE public.billing_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_billing_requests_select" ON public.billing_requests
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

ALTER TABLE public.trial_lifecycle_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trial_emails_select" ON public.trial_lifecycle_emails
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

-- Index for cron queries
CREATE INDEX IF NOT EXISTS idx_tenants_trial_ends ON public.tenants (trial_ends_at)
  WHERE subscription_status = 'trialing';
CREATE INDEX IF NOT EXISTS idx_billing_requests_tenant ON public.billing_requests (tenant_id);
