import { NextResponse } from "next/server";
// eslint-disable-next-line no-restricted-imports -- service-role: cron runs outside user JWT context (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { generateStandupDigest, sendStandupToSlack, sendStandupEmail } from "@/lib/services/standupDigest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handler(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createSupabaseServiceClient();
  const { data: tenants } = await svc
    .from("tenants")
    .select("id, slug")
    .eq("status", "active");

  const results: Record<string, string> = {};

  for (const tenant of tenants ?? []) {
    const id = tenant.id as string;
    const slug = tenant.slug as string;
    try {
      const digest = await generateStandupDigest(id);
      await Promise.all([
        sendStandupToSlack(id, slug, digest),
        sendStandupEmail(id, slug, digest),
      ]);
      results[id] = `ok — ${digest.stats.shipped_today} shipped, ${digest.stats.in_progress} in progress, ${digest.stats.blocked} blocked`;
    } catch (e) {
      results[id] = `error: ${String(e)}`;
    }
  }

  return NextResponse.json({ generated: Object.keys(results).length, results });
}

export { handler as GET, handler as POST };
