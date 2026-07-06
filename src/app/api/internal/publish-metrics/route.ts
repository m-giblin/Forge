// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/app/api/internal/publish-metrics/route.ts
//       (place this in the FORGE codebase, not G4 Core)
//
// ENV VARS needed in Forge (.env.local):
//   G4_PUBLISH_SECRET=<same value as FORGE_PUBLISH_SECRET in G4 Core>
//   G4_INGEST_URL=https://your-g4-core.vercel.app/api/ingest/forge
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforceInternalSecret } from "@/lib/api/internalRoute";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// grok-3-mini pricing (per million tokens)
const GROK_PRICE = { in: 0.30, out: 0.50 };

// Return 404 on GET so the route doesn't fingerprint itself as existing.
export function GET() {
  return new Response(null, { status: 404 });
}

export async function POST(request: NextRequest) {
  const denied = enforceInternalSecret(request, process.env.G4_PUBLISH_SECRET);
  if (denied) return denied;

  const ingestUrl = process.env.G4_INGEST_URL;
  if (!ingestUrl) {
    console.error("[publish-metrics] G4_INGEST_URL env var is not set");
    return NextResponse.json({ error: "Service misconfigured" }, { status: 503 });
  }

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Tenant counts
    const [
      { count: tenantsTotal },
      { count: tenantsActive },
      { count: tenantsTrialing },
    ] = await Promise.all([
      sb.from("tenants").select("*", { count: "exact", head: true }),
      sb.from("tenants").select("*", { count: "exact", head: true })
        .eq("subscription_status", "active"),
      sb.from("tenants").select("*", { count: "exact", head: true })
        .eq("subscription_status", "trialing"),
    ]);

    // User counts
    const { count: usersTotal } = await sb
      .from("users")
      .select("*", { count: "exact", head: true });

    // New tenants last 30d
    const { count: newTenants30d } = await sb
      .from("tenants")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo);

    // Churned = expired in last 30d
    const { count: churnedTenants30d } = await sb
      .from("tenants")
      .select("*", { count: "exact", head: true })
      .gte("updated_at", thirtyDaysAgo)
      .in("subscription_status", ["expired", "cancelled"]);

    // Revenue — compute from billing_requests (active subscriptions)
    // Forge tier pricing: basic free, premium/pro = TBD. Using seat-based estimate.
    // Replace with Stripe data once wired.
    const { data: activeBilling } = await sb
      .from("billing_requests")
      .select("tier, seats, amount_cents")
      .eq("status", "active");

    let mrrCents = 0;
    for (const b of activeBilling ?? []) {
      // Use amount_cents if present, else estimate by tier
      if (b.amount_cents) {
        mrrCents += b.amount_cents;
      } else {
        const tierRate = b.tier === "enterprise" ? 50000 : b.tier === "pro" ? 20000 : 10000;
        mrrCents += tierRate * (b.seats ?? 1);
      }
    }
    const arrCents = mrrCents * 12;
    const activeCount = tenantsActive ?? 0;
    const arpuCents = activeCount > 0 ? Math.round(mrrCents / activeCount) : 0;

    // AI costs from idea_ai_turns (last 30d)
    const { data: aiTurns } = await sb
      .from("idea_ai_turns")
      .select("tokens_input, tokens_output")
      .gte("created_at", thirtyDaysAgo);

    let totalTokensIn = 0, totalTokensOut = 0;
    for (const t of aiTurns ?? []) {
      totalTokensIn += t.tokens_input ?? 0;
      totalTokensOut += t.tokens_output ?? 0;
    }

    const aiCostUsd = (totalTokensIn / 1e6) * GROK_PRICE.in + (totalTokensOut / 1e6) * GROK_PRICE.out;
    const aiCost30dCents = Math.round(aiCostUsd * 100);
    const aiCostPerUserCents = activeCount > 0
      ? Math.round(aiCost30dCents / activeCount)
      : 0;

    const payload = {
      recorded_at:             new Date().toISOString(),
      subscribers_active:      activeCount,
      subscribers_new_30d:     newTenants30d ?? 0,
      subscribers_churned_30d: churnedTenants30d ?? 0,
      subscribers_trial:       tenantsTrialing ?? 0,
      mrr_cents:               mrrCents,
      arr_cents:               arrCents,
      arpu_cents:              arpuCents,
      users_registered:        usersTotal ?? 0,
      users_active_30d:        activeCount, // tenants as proxy until usage events exist
      ai_cost_30d_cents:       aiCost30dCents,
      ai_cost_per_user_cents:  aiCostPerUserCents,
      ai_requests_30d:         aiTurns?.length ?? 0,
      ai_top_workflows:        [{ name: "Think Tank / Sounding Board", cost_cents: aiCost30dCents }],
      source:                  "forge-api",
      confidence:              mrrCents === 0 ? "estimated" : "live",
    };

    const g4Res = await fetch(ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-g4-secret": process.env.G4_PUBLISH_SECRET!,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });

    if (!g4Res.ok) throw new Error(`G4 ingest rejected: ${g4Res.status}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[publish-metrics] forge error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
