import "server-only";
import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/services/stripeConfig";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

/** Returns a configured Stripe client, or null if no secret key has been set yet in /admin/settings/billing. */
export async function getStripeClient(): Promise<Stripe | null> {
  const secretKey = await getStripeSecretKey();
  if (!secretKey) return null;
  return new Stripe(secretKey);
}

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: "not_configured" | "no_price" | "error"; message?: string };

/**
 * Creates a Stripe Checkout session for a tenant to subscribe to a plan tier.
 * Returns { ok: false, reason: "not_configured" } if Stripe hasn't been set up yet,
 * or { reason: "no_price" } if this plan tier has no stripe_price_id mapped —
 * both are expected states before Stripe is fully wired up, not errors.
 */
export async function createCheckoutSession(input: {
  tenantId: string;
  slug: string;
  planKey: string;
  seats: number;
  customerEmail: string | null;
}): Promise<CheckoutResult> {
  const stripe = await getStripeClient();
  if (!stripe) return { ok: false, reason: "not_configured" };

  const svc = createSupabaseServiceClient();
  const { data: plan } = await svc
    .from("plan_tiers")
    .select("stripe_price_id")
    .eq("key", input.planKey)
    .maybeSingle();

  const priceId = plan?.stripe_price_id as string | null;
  if (!priceId) return { ok: false, reason: "no_price" };

  const { data: tenant } = await svc
    .from("tenants")
    .select("stripe_customer_id")
    .eq("id", input.tenantId)
    .maybeSingle();

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: input.seats }],
      customer: (tenant?.stripe_customer_id as string | null) ?? undefined,
      customer_email: tenant?.stripe_customer_id ? undefined : (input.customerEmail ?? undefined),
      client_reference_id: input.tenantId,
      subscription_data: { metadata: { tenant_id: input.tenantId, plan_key: input.planKey } },
      success_url: `${baseUrl}/${input.slug}/billing?checkout=success`,
      cancel_url: `${baseUrl}/${input.slug}/billing?checkout=cancelled`,
    });
    if (!session.url) return { ok: false, reason: "error", message: "Stripe did not return a checkout URL." };
    return { ok: true, url: session.url };
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

export type PortalResult = { ok: true; url: string } | { ok: false; reason: "not_configured" | "no_customer" | "error"; message?: string };

/** Creates a Stripe Customer Portal session so a tenant owner can manage/cancel their own subscription. */
export async function createBillingPortalSession(input: { tenantId: string; slug: string }): Promise<PortalResult> {
  const stripe = await getStripeClient();
  if (!stripe) return { ok: false, reason: "not_configured" };

  const svc = createSupabaseServiceClient();
  const { data: tenant } = await svc
    .from("tenants")
    .select("stripe_customer_id")
    .eq("id", input.tenantId)
    .maybeSingle();

  const customerId = tenant?.stripe_customer_id as string | null;
  if (!customerId) return { ok: false, reason: "no_customer" };

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/${input.slug}/billing`,
    });
    return { ok: true, url: session.url };
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
