import { NextRequest, NextResponse } from "next/server";
import { runTrialLifecycle } from "@/lib/services/trialLifecycle";

// Nightly cron: checks trial status, sends lifecycle emails, auto-expires trials.
// Call via: GET /api/cron/trial-lifecycle
// Protected by CRON_SECRET header.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runTrialLifecycle();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[cron/trial-lifecycle]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
