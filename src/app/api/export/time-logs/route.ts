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
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;

  let q = svc
    .from("issue_time_logs")
    .select("id, issue_id, user_id, minutes, note, logged_at, created_at")
    .eq("tenant_id", ctx.tenant.id)
    .order("logged_at", { ascending: false });
  if (from) q = q.gte("logged_at", from);
  if (to) q = q.lte("logged_at", to);

  const { data: logs, error } = await q;
  if (error) return NextResponse.json({ error: "Query failed" }, { status: 500 });

  const issueIds = [...new Set((logs ?? []).map((l) => l.issue_id as string))];
  const userIds = [...new Set((logs ?? []).map((l) => l.user_id as string).filter(Boolean))];

  const [issRes, userRes] = await Promise.all([
    issueIds.length
      ? svc.from("issues").select("id, number, title, project_id").eq("tenant_id", ctx.tenant.id).in("id", issueIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? svc.from("users").select("id, name").in("id", userIds)
      : Promise.resolve({ data: [] }),
  ]);

  const projectIds = [...new Set((issRes.data ?? []).map((i) => i.project_id as string))];
  const projRes = projectIds.length
    ? await svc.from("projects").select("id, key").in("id", projectIds)
    : { data: [] };

  const projKey = new Map((projRes.data ?? []).map((p) => [p.id, p.key]));
  const issMap = new Map((issRes.data ?? []).map((i) => [i.id, i]));
  const userMap = new Map((userRes.data ?? []).map((u) => [u.id, u.name ?? u.id]));

  const headers = ["issue_key", "issue_title", "logged_by", "hours", "minutes", "note", "logged_at"];
  const rows = (logs ?? []).map((l) => {
    const iss = issMap.get(l.issue_id as string);
    const issKey = iss ? `${projKey.get(iss.project_id) ?? "??"}−${iss.number}` : l.issue_id;
    const hrs = Math.floor((l.minutes as number) / 60);
    const mins = (l.minutes as number) % 60;
    return [
      issKey,
      iss?.title ?? "",
      userMap.get(l.user_id as string) ?? "",
      hrs,
      mins,
      l.note,
      l.logged_at,
    ].map(csvEscape).join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="time-logs.csv"',
    },
  });
}
