import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { z } from "zod";

const Body = z.object({
  tier: z.enum(["basic", "premium", "pro", "enterprise"]),
  seats: z.number().int().min(1).max(500),
});

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

  const { tier, seats } = parsed.data;

  const PRICE_CENTS: Record<string, number> = {
    basic: 9_00,
    premium: 19_00,
    pro: 0,
    enterprise: 0,
  };

  const svc = createSupabaseServiceClient();

  const { error } = await svc.from("billing_requests").insert({
    tenant_id: ctx.tenant.id,
    tier,
    seats,
    status: "pending",
    amount_cents: (PRICE_CENTS[tier] ?? 0) * seats,
    currency: "usd",
  });

  if (error) {
    console.error("[billing/request]", error.message);
    return NextResponse.json({ error: "Failed to submit billing request." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
