import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { exportSubjectData } from "@/lib/services/gdprExport";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// GET /api/me/export  — returns a JSON download of the authenticated user's own data
// Rate-limited to once per hour per user (enforced in-memory; good enough pre-Redis)
const exportCooldowns = new Map<string, number>();
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Cooldown: once per hour
  const last = exportCooldowns.get(user.id) ?? 0;
  if (Date.now() - last < COOLDOWN_MS) {
    const retryAfterSec = Math.ceil((last + COOLDOWN_MS - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Export already requested. Please wait before requesting another." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  // Look up the user's email (may be encrypted in app users table — use auth email)
  const svc = createSupabaseServiceClient();
  const { data: appUser } = await svc
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!appUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const exportData = await exportSubjectData(user.email);
    exportCooldowns.set(user.id, Date.now());

    const filename = `forge-data-export-${user.id.slice(0, 8)}.json`;
    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Export failed. Please try again." }, { status: 500 });
  }
}
