import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export interface BurndownPoint { date: string; ideal: number; actual: number }
export interface BurndownResult {
  sprint: { id: string; name: string; startDate: string; endDate: string; goal: string | null };
  totalPoints: number;
  points: BurndownPoint[];
  completedPoints: number;
  remainingPoints: number;
}

export async function GET(req: NextRequest) {
  const tenantSlug = req.headers.get("x-tenant-slug");
  if (!tenantSlug) return NextResponse.json({ error: "Missing x-tenant-slug" }, { status: 400 });

  const ctx = await getTenantContext(tenantSlug);
  if (!ctx) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  if (!ctxCanDo(ctx, "view_reports")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sprintId = req.nextUrl.searchParams.get("sprintId");
  if (!sprintId) return NextResponse.json({ error: "sprintId required" }, { status: 400 });

  const svc = createSupabaseServiceClient();

  const [sprintRes, issuesRes] = await Promise.all([
    svc.from("sprints").select("id, name, goal, start_date, end_date, project_id, status").eq("tenant_id", ctx.tenant.id).eq("id", sprintId).maybeSingle(),
    svc.from("issues").select("id, story_points, status, created_at").eq("tenant_id", ctx.tenant.id).eq("sprint_id", sprintId),
  ]);

  const sprint = sprintRes.data;
  if (!sprint) return NextResponse.json({ error: "Sprint not found" }, { status: 404 });

  const issues = issuesRes.data ?? [];
  const DONE_STATUSES = new Set(["done", "closed"]);

  const totalPoints = issues.reduce((s, i) => s + ((i.story_points as number | null) ?? 0), 0);

  // Get all status-change events to 'done'/'closed' for these issue IDs within the sprint window
  const issueIds = issues.map((i) => i.id as string);
  const startDate = new Date(sprint.start_date as string);
  const endDate = new Date(sprint.end_date as string);

  // Clamp end date to today if sprint is active
  const today = new Date();
  const effectiveEnd = endDate > today ? today : endDate;

  const eventsRes = issueIds.length > 0
    ? await svc.from("issue_events")
        .select("issue_id, new_value, created_at")
        .eq("tenant_id", ctx.tenant.id)
        .eq("field", "status")
        .in("new_value", ["done", "closed"])
        .in("issue_id", issueIds)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", effectiveEnd.toISOString())
        .order("created_at", { ascending: true })
    : { data: [] };

  const events = eventsRes.data ?? [];

  // Build a map: issueId -> earliest done event date
  const doneAt = new Map<string, Date>();
  for (const ev of events) {
    const id = ev.issue_id as string;
    const d = new Date(ev.created_at as string);
    if (!doneAt.has(id) || d < doneAt.get(id)!) doneAt.set(id, d);
  }

  // For issues already done before sprint start (status='done' with no event in window), mark as done on day 0
  for (const issue of issues) {
    if (DONE_STATUSES.has(issue.status as string) && !doneAt.has(issue.id as string)) {
      doneAt.set(issue.id as string, startDate);
    }
  }

  // Build daily burndown array
  const points: BurndownPoint[] = [];
  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));

  // Build issue points map
  const issuePoints = new Map(issues.map((i) => [i.id as string, (i.story_points as number | null) ?? 0]));

  const cur = new Date(startDate);
  let dayIndex = 0;
  while (cur <= effectiveEnd) {
    const dateStr = cur.toISOString().slice(0, 10);
    // Points completed up to end of this day
    const completedByDay = Array.from(doneAt.entries())
      .filter(([, d]) => d <= new Date(dateStr + "T23:59:59Z"))
      .reduce((s, [id]) => s + (issuePoints.get(id) ?? 0), 0);

    const actual = Math.max(0, totalPoints - completedByDay);
    const ideal = totalPoints - (totalPoints * (dayIndex / totalDays));

    points.push({ date: dateStr, ideal: Math.round(ideal * 10) / 10, actual });
    cur.setDate(cur.getDate() + 1);
    dayIndex++;
  }

  const completedPoints = Array.from(doneAt.keys()).reduce((s, id) => s + (issuePoints.get(id) ?? 0), 0);

  return NextResponse.json({
    sprint: {
      id: sprint.id, name: sprint.name, goal: sprint.goal,
      startDate: sprint.start_date, endDate: sprint.end_date,
    },
    totalPoints,
    completedPoints,
    remainingPoints: Math.max(0, totalPoints - completedPoints),
    points,
  } satisfies BurndownResult);
}
