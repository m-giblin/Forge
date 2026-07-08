import { NextResponse } from "next/server";
import { SCOPES } from "@/lib/api/scopes";
import { enforce } from "@/lib/api/gate";
// eslint-disable-next-line no-restricted-imports -- service-role: recurring issue writes (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const gate = await enforce(req, SCOPES.ISSUES_READ);
  if (gate.error) return gate.error;
  const { tenantId } = gate.auth;

  const url = new URL(req.url);
  const projectId = url.searchParams.get("project_id") ?? undefined;

  const svc = createSupabaseServiceClient();
  let q = svc
    .from("recurring_issues")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at");
  if (projectId) q = q.eq("project_id", projectId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Query failed" }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const gate = await enforce(req, SCOPES.ISSUES_WRITE);
  if (gate.error) return gate.error;
  const { tenantId } = gate.auth;

  const body = await req.json() as {
    project_id: string;
    title: string;
    type?: string;
    priority?: string;
    description?: string;
    trigger?: string;
    interval_sprints?: number;
  };

  if (!body.project_id || !body.title?.trim()) {
    return NextResponse.json({ error: "project_id and title are required" }, { status: 422 });
  }

  const svc = createSupabaseServiceClient();

  // Verify project belongs to tenant
  const { data: project } = await svc
    .from("projects")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", body.project_id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data, error } = await svc
    .from("recurring_issues")
    .insert({
      tenant_id: tenantId,
      project_id: body.project_id,
      title: body.title.trim(),
      type: body.type ?? "task",
      priority: body.priority ?? "medium",
      description: body.description ?? null,
      trigger: body.trigger ?? "every_sprint",
      interval_sprints: body.interval_sprints ?? 1,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
