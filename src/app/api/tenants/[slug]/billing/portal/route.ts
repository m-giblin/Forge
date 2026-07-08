import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { createBillingPortalSession } from "@/lib/services/stripeBilling";

export const runtime = "nodejs";

/** POST /api/tenants/[slug]/billing/portal — Stripe Customer Portal link, once Stripe + a customer exist. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "Only workspace owners can manage billing." }, { status: 403 });

  const result = await createBillingPortalSession({ tenantId: ctx.tenant.id, slug });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason, message: result.message ?? null }, { status: 200 });
  }
  return NextResponse.json({ url: result.url });
}
