import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v).replace(/"/g, '""');
  return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s}"` : s;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") ?? "";
  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "owner" && ctx.role !== "admin")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const svc = createSupabaseServiceClient();
  const projectKey = url.searchParams.get("project_key") ?? undefined;

  let projectId: string | undefined;
  if (projectKey) {
    const { data: proj } = await svc
      .from("projects")
      .select("id")
      .eq("tenant_id", ctx.tenant.id)
      .eq("key", projectKey)
      .maybeSingle();
    projectId = proj?.id;
  }

  let q = svc
    .from("sprints")
    .select("id, name, goal, status, start_date, end_date, created_at, project_id")
    .eq("tenant_id", ctx.tenant.id)
    .order("created_at");
  if (projectId) q = q.eq("project_id", projectId);

  const { data: sprints, error } = await q;
  if (error) return NextResponse.json({ error: "Query failed" }, { status: 500 });

  // Enrich with project key + issue counts
  const projectIds = [...new Set((sprints ?? []).map((s) => s.project_id as string))];
  const [projRes, issueRes] = await Promise.all([
    projectIds.length
      ? svc.from("projects").select("id, key").in("id", projectIds)
      : Promise.resolve({ data: [] }),
    (sprints ?? []).length
      ? svc
          .from("issues")
          .select("sprint_id, status")
          .eq("tenant_id", ctx.tenant.id)
          .in("sprint_id", (sprints ?? []).map((s) => s.id as string))
      : Promise.resolve({ data: [] }),
  ]);

  const projKey = new Map((projRes.data ?? []).map((p) => [p.id, p.key]));
  const issueBySprint = new Map<string, { total: number; done: number }>();
  for (const iss of issueRes.data ?? []) {
    const sid = iss.sprint_id as string;
    const cur = issueBySprint.get(sid) ?? { total: 0, done: 0 };
    cur.total++;
    if (iss.status === "done" || iss.status === "closed") cur.done++;
    issueBySprint.set(sid, cur);
  }

  const headers = ["project", "sprint_name", "goal", "status", "start_date", "end_date", "total_issues", "done_issues", "velocity_pct", "created_at"];
  const rows = (sprints ?? []).map((s) => {
    const counts = issueBySprint.get(s.id as string) ?? { total: 0, done: 0 };
    const pct = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;
    return [
      projKey.get(s.project_id as string) ?? "",
      s.name,
      s.goal,
      s.status,
      s.start_date,
      s.end_date,
      counts.total,
      counts.done,
      `${pct}%`,
      s.created_at,
    ].map(csvEscape).join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sprints.csv"',
    },
  });
}
