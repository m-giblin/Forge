import { NextResponse } from "next/server";
import { eraseSubjectData } from "@/lib/services/gdprErasure";
import { requireSuperAdmin } from "@/lib/super-admin";

// POST /api/admin/compliance/erase  { email }
export async function POST(req: Request) {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const { email } = body as { email?: string };
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  try {
    const result = await eraseSubjectData(email);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erasure failed";
    const status = msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
