import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { setCurrentProjectId } from "@/lib/currentProject";

// POST /api/current-project — sets the caller's sticky "current project" for a
// tenant (FORGE-188). Body: { slug: string, projectId: string | "all" }.
export async function POST(request: NextRequest) {
  let body: { slug?: string; projectId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { slug, projectId } = body;
  if (!slug || !projectId) {
    return NextResponse.json({ error: "slug and projectId are required" }, { status: 400 });
  }

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await setCurrentProjectId(ctx.tenant.id, projectId);
  return NextResponse.json({ ok: true });
}
