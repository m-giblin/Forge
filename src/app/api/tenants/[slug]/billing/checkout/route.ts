import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/services/stripeBilling";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({
  tier: z.enum(["basic", "premium", "pro", "enterprise"]),
  seats: z.number().int().min(1).max(500),
});

/**
 * POST /api/tenants/[slug]/billing/checkout
 *
 * Real Stripe Checkout once Stripe is configured (secret key + a price ID for
 * this tier are both set in /admin/settings/billing). Returns a distinct
 * "not_configured"/"no_price" reason otherwise so the client can fall back to
 * the existing manual request flow — no behavior change until keys are added.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "Only workspace owners can manage billing." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const result = await createCheckoutSession({
    tenantId: ctx.tenant.id,
    slug,
    planKey: parsed.data.tier,
    seats: parsed.data.seats,
    customerEmail: ctx.email ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.reason, message: result.message ?? null }, { status: 200 });
  }
  return NextResponse.json({ url: result.url });
}
