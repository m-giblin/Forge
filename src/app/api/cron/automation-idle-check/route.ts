import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { runAutomations } from "@/lib/services/automation";
import type { Issue } from "@/lib/repositories/issues";
import { verifyCronAuth } from "@/lib/api/cronAuth";

export const dynamic = "force-dynamic";

/**
 * Fires the "issue.idle" automation trigger for issues untouched 5+ days.
 * Windowed to 5-6 days since last update (not "5 or more") so a daily cron
 * run fires each issue once around the threshold instead of re-firing every
 * day it stays idle — repeating "post comment"/"fire webhook" actions daily
 * forever would be spam, not automation.
 */
async function handler(req: Request) {
  if (!verifyCronAuth(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createSupabaseServiceClient();
  const now = Date.now();
  const sixDaysAgo = new Date(now - 6 * 86_400_000).toISOString();
  const fiveDaysAgo = new Date(now - 5 * 86_400_000).toISOString();

  const { data: tenants } = await svc.from("tenants").select("id");

  const results: Record<string, string> = {};
  for (const t of tenants ?? []) {
    try {
      const { data: idleIssues } = await svc
        .from("issues")
        .select("*")
        .eq("tenant_id", t.id)
        .not("status", "in", "(done,closed)")
        .gte("updated_at", sixDaysAgo)
        .lt("updated_at", fiveDaysAgo);

      for (const issue of (idleIssues ?? []) as Issue[]) {
        await runAutomations(t.id, "issue.idle", issue);
      }
      results[t.id] = `ok (${idleIssues?.length ?? 0})`;
    } catch (e) {
      results[t.id] = String(e);
    }
  }

  return NextResponse.json({ results });
}

export { handler as GET, handler as POST };
