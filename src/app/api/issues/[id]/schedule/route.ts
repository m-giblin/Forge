import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: issueId } = await params;
  const body = await req.json();
  const { slug, start_date, due_date, assignee_id } = body as {
    slug: string;
    start_date?: string | null;
    due_date?: string | null;
    assignee_id?: string | null;
  };

  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createSupabaseServiceClient();

  const { data: issue } = await svc
    .from("issues")
    .select("id")
    .eq("id", issueId)
    .eq("tenant_id", ctx.tenant.id)
    .single();

  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (start_date !== undefined) update.start_date = start_date;
  if (due_date !== undefined) update.due_date = due_date;
  if (assignee_id !== undefined) update.assignee_id = assignee_id;

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { error } = await svc
    .from("issues")
    .update(update)
    .eq("id", issueId)
    .eq("tenant_id", ctx.tenant.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
