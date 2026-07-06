import { NextResponse } from "next/server";
// eslint-disable-next-line no-restricted-imports -- service-role: cron runs outside user JWT context (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { runSlaCron } from "@/lib/services/sla";
import { verifyCronAuth } from "@/lib/api/cronAuth";

export const dynamic = "force-dynamic";

async function handler(req: Request) {
  // Verify Vercel cron secret (or internal calls)
  if (!verifyCronAuth(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createSupabaseServiceClient();
  const { data: tenants } = await svc.from("tenants").select("id");

  const results: Record<string, string> = {};
  for (const t of tenants ?? []) {
    try {
      await runSlaCron(t.id);
      results[t.id] = "ok";
    } catch (e) {
      results[t.id] = String(e);
    }
  }

  return NextResponse.json({ results });
}

export { handler as GET, handler as POST };
