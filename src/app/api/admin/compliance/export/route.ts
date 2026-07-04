import { NextResponse } from "next/server";
import { exportSubjectData } from "@/lib/services/gdprExport";
import { requireSuperAdmin } from "@/lib/super-admin";

// POST /api/admin/compliance/export  { email: string }
// Body (not URL param) so the subject's email doesn't appear in server/CDN logs.
export async function POST(req: Request) {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let email: string | undefined;
  try {
    const body = await req.json();
    email = typeof body?.email === "string" ? body.email.trim() : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  try {
    const data = await exportSubjectData(email);
    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="gdpr-export.json"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export failed";
    const status = msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
