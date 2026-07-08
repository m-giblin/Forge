import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/services/stripeBilling";
import { getStripeWebhookSecret } from "@/lib/services/stripeConfig";
// eslint-disable-next-line no-restricted-imports -- service-role: webhook writes span tenants + billing_requests (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/stripe
 *
 * Inert until Stripe is configured in /admin/settings/billing — with no
 * webhook secret saved, every request is rejected with 503 rather than
 * silently accepted, so a misconfigured endpoint fails loud, not open.
 */
export async function POST(req: Request) {
  const stripe = await getStripeClient();
  const webhookSecret = await getStripeWebhookSecret();
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe is not configured yet." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (e) {
    logger.warn("Stripe webhook signature verification failed", { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const svc = createSupabaseServiceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.client_reference_id;
        if (!tenantId) break;

        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;

        if (customerId) {
          await svc.from("tenants").update({ stripe_customer_id: customerId }).eq("id", tenantId);
        }
        if (subscriptionId) {
          await svc.from("billing_requests").insert({
            tenant_id: tenantId,
            tier: (session.metadata?.plan_key as string) ?? "unknown",
            seats: 1,
            status: "active",
            stripe_session_id: session.id,
            stripe_subscription_id: subscriptionId,
            amount_cents: session.amount_total ?? null,
            currency: session.currency ?? "usd",
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const tenantId = sub.metadata?.tenant_id;
        if (!tenantId) break;

        const planKey = sub.metadata?.plan_key ?? "basic";
        const seats = sub.items.data[0]?.quantity ?? 1;
        const status = sub.status === "trialing" || sub.status === "active" ? sub.status : "active";

        await svc.from("tenants").update({
          subscription_status: status,
          subscription_tier: planKey,
          subscription_seats: seats,
          plan: planKey, // keep the legacy display column in sync — see migration 0097
        }).eq("id", tenantId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const tenantId = sub.metadata?.tenant_id;
        if (!tenantId) break;

        await svc.from("tenants").update({
          subscription_status: "cancelled",
        }).eq("id", tenantId);
        break;
      }

      default:
        // Unhandled event types are expected — Stripe sends many we don't act on.
        break;
    }
  } catch (e) {
    logger.error("Stripe webhook handler error", { eventType: event.type, error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
