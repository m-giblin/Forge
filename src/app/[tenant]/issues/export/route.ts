import { NextRequest } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ctxCanDo } from "@/lib/rbac";

export const runtime = "nodejs";

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v).replace(/"/g, '""');
  return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s}"` : s;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  if (!ctxCanDo(ctx, "export_data")) return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const statusFilter  = url.searchParams.get("status") ?? "";
  const priorityFilter = url.searchParams.get("priority") ?? "";
  const typeFilter    = url.searchParams.get("type") ?? "";
  const assigneeFilter = url.searchParams.get("assignee") ?? "";
  const q             = url.searchParams.get("q") ?? "";

  const svc = createSupabaseServiceClient();

  let query = svc
    .from("issues")
    .select("number, project_id, title, description, type, status, priority, assignee_id, phase, start_date, due_date, created_at, updated_at, external_id")
    .eq("tenant_id", ctx.tenant.id)
    .order("created_at", { ascending: false });

  if (statusFilter)   query = query.eq("status", statusFilter);
  if (priorityFilter) query = query.eq("priority", priorityFilter);
  if (typeFilter)     query = query.eq("type", typeFilter);
  if (assigneeFilter === "none") query = query.is("assignee_id", null);
  else if (assigneeFilter) query = query.eq("assignee_id", assigneeFilter);
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return new Response("Export failed", { status: 500 });

  const projectIds  = [...new Set((data ?? []).map((r) => r.project_id as string))];
  const assigneeIds = [...new Set((data ?? []).map((r) => r.assignee_id as string | null).filter(Boolean))] as string[];

  const [projectsRes, usersRes] = await Promise.all([
    projectIds.length > 0 ? svc.from("projects").select("id,key").in("id", projectIds) : Promise.resolve({ data: [] as { id: string; key: string }[] }),
    assigneeIds.length > 0 ? svc.from("users").select("id,name,email").in("id", assigneeIds) : Promise.resolve({ data: [] as { id: string; name: string | null; email: string }[] }),
  ]);

  const projectKey = new Map((projectsRes.data ?? []).map((p) => [p.id, p.key]));
  const userName   = new Map((usersRes.data ?? []).map((u) => [u.id, u.name || u.email]));

  const headers = ["key", "title", "description", "type", "status", "priority", "assignee", "phase", "start_date", "due_date", "created_at", "updated_at", "external_id"];
  const rows = (data ?? []).map((r) => [
    `${projectKey.get(r.project_id as string) ?? "??"}-${r.number}`,
    r.title, r.description, r.type, r.status, r.priority,
    r.assignee_id ? (userName.get(r.assignee_id as string) ?? r.assignee_id) : "",
    r.phase, r.start_date, r.due_date, r.created_at, r.updated_at, r.external_id,
  ].map(csvEscape).join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  const slug2 = slug;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug2}-issues.csv"`,
    },
  });
}
