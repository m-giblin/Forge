import { NextResponse } from "next/server";
import { exportSubjectData } from "@/lib/services/gdprExport";
import { requireSuperAdmin } from "@/lib/super-admin";

// GET /api/admin/compliance/export?email=<email>
export async function GET(req: Request) {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const email = new URL(req.url).searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  try {
    const data = await exportSubjectData(email);
    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="gdpr-export-${email.replace(/[^a-z0-9]/gi, "-")}.json"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export failed";
    const status = msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
