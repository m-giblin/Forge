import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export interface CfdStatus { key: string; label: string; color: string | null }
export interface CfdPoint { date: string; counts: Record<string, number> }
export interface CfdResult {
  project: { id: string; name: string };
  statuses: CfdStatus[];
  points: CfdPoint[];
}

const ALLOWED_DAYS = new Set([30, 60, 90]);

export async function GET(req: NextRequest) {
  const tenantSlug = req.headers.get("x-tenant-slug");
  if (!tenantSlug) return NextResponse.json({ error: "Missing x-tenant-slug" }, { status: 400 });

  const ctx = await getTenantContext(tenantSlug);
  if (!ctx) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  if (!ctxCanDo(ctx, "view_reports")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  const daysParam = parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10);
  const days = ALLOWED_DAYS.has(daysParam) ? daysParam : 30;

  const svc = createSupabaseServiceClient();

  const [projectRes, optionsRes] = await Promise.all([
    svc.from("projects").select("id, name").eq("tenant_id", ctx.tenant.id).eq("id", projectId).maybeSingle(),
    svc.from("tenant_field_options").select("key, label, color, position").eq("tenant_id", ctx.tenant.id).eq("field", "status").order("position"),
  ]);

  const project = projectRes.data;
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Stack order: terminal/latest workflow steps at the bottom (standard CFD reading —
  // the "done" band forms the growing base other statuses flow into), so reverse position order.
  const statuses: CfdStatus[] = ((optionsRes.data ?? []) as { key: string; label: string; color: string | null }[])
    .slice()
    .reverse();
  const knownKeys = new Set(statuses.map((s) => s.key));

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  // Every issue that existed at any point in the window: created before "today" end-of-day.
  const { data: issueRows } = await svc
    .from("issues")
    .select("id, status, created_at")
    .eq("tenant_id", ctx.tenant.id)
    .eq("project_id", projectId)
    .lte("created_at", today.toISOString());

  const issues = (issueRows ?? []) as { id: string; status: string; created_at: string }[];
  const issueIds = issues.map((i) => i.id);

  const { data: eventRows } = issueIds.length
    ? await svc
        .from("issue_events")
        .select("issue_id, old_value, new_value, created_at")
        .eq("tenant_id", ctx.tenant.id)
        .eq("field", "status")
        .in("issue_id", issueIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const eventsByIssue = new Map<string, { oldValue: string; newValue: string; at: number }[]>();
  for (const ev of eventRows ?? []) {
    const id = ev.issue_id as string;
    const list = eventsByIssue.get(id) ?? [];
    list.push({ oldValue: ev.old_value as string, newValue: ev.new_value as string, at: new Date(ev.created_at as string).getTime() });
    eventsByIssue.set(id, list);
  }

  /** Status a given issue was in as of the end of `dayEndMs`. */
  function statusAsOf(issue: { id: string; status: string }, dayEndMs: number): string {
    const events = eventsByIssue.get(issue.id);
    if (!events || events.length === 0) return issue.status;
    const past = events.filter((e) => e.at <= dayEndMs);
    if (past.length === 0) return events[0].oldValue;
    return past[past.length - 1].newValue;
  }

  const points: CfdPoint[] = [];
  const cur = new Date(startDate);
  while (cur <= today) {
    const dateStr = cur.toISOString().slice(0, 10);
    const dayEndMs = new Date(dateStr + "T23:59:59.999Z").getTime();

    const counts: Record<string, number> = {};
    for (const s of statuses) counts[s.key] = 0;
    let otherCount = 0;

    for (const issue of issues) {
      if (new Date(issue.created_at).getTime() > dayEndMs) continue; // not created yet as of this day
      const status = statusAsOf(issue, dayEndMs);
      if (knownKeys.has(status)) counts[status] += 1;
      else otherCount += 1; // status value no longer configured (renamed/deleted) — don't drop it silently
    }
    if (otherCount > 0) counts["__other__"] = otherCount;

    points.push({ date: dateStr, counts });
    cur.setDate(cur.getDate() + 1);
  }

  const hasOther = points.some((p) => "__other__" in p.counts);
  const allStatuses = hasOther ? [...statuses, { key: "__other__", label: "Other", color: "#9CA3AF" }] : statuses;

  return NextResponse.json({ project, statuses: allStatuses, points } satisfies CfdResult);
}
