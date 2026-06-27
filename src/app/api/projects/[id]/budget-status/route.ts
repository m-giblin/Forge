import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { getProjectBudgetStatus } from "@/lib/services/projectBudget";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = await getProjectBudgetStatus(ctx.tenant.id, id).catch(() => null);
  if (!status) return NextResponse.json({ error: "Failed to load budget status" }, { status: 500 });

  return NextResponse.json(status);
}
