import { NextResponse } from "next/server";
import { SCOPES } from "@/lib/api/scopes";
import { enforce } from "@/lib/api/gate";
// eslint-disable-next-line no-restricted-imports -- service-role: recurring issue writes (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await enforce(req, SCOPES.ISSUES_WRITE);
  if (gate.error) return gate.error;
  const { tenantId } = gate.auth;
  const { id } = await params;

  const body = await req.json() as Record<string, unknown>;
  const allowed = ["title", "type", "priority", "description", "trigger", "interval_sprints", "is_active"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) patch[k] = body[k];

  const svc = createSupabaseServiceClient();
  const { data, error } = await svc
    .from("recurring_issues")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await enforce(req, SCOPES.ISSUES_WRITE);
  if (gate.error) return gate.error;
  const { tenantId } = gate.auth;
  const { id } = await params;

  const svc = createSupabaseServiceClient();
  await svc.from("recurring_issues").delete().eq("tenant_id", tenantId).eq("id", id);
  return new Response(null, { status: 204 });
}
