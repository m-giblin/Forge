import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { projectsRepo } from "@/lib/repositories/projects";
import type { Project } from "@/lib/services/issues";

export type StatusCount = { status: string; count: number };
export type PriorityCount = { priority: string; count: number };
export type AssigneeCount = { assigneeId: string | null; name: string; count: number };
export type WeekPoint = { label: string; opened: number; closed: number };

export type ReportsData = {
  totalOpen: number;
  totalDone: number;
  byStatus: StatusCount[];
  byPriority: PriorityCount[];
  byAssignee: AssigneeCount[];
  weeklyTrend: WeekPoint[];
  projects: Project[];
};

export async function loadReports(
  tenantId: string,
  from: Date,
  to: Date,
  projectId: string | null,
  impersonating = false,
): Promise<ReportsData> {
  const supabase = impersonating ? createSupabaseServiceClient() : await createSupabaseServerClient();

  let q = supabase
    .from("issues")
    .select("id, status, priority, assignee_id, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString());

  if (projectId) q = q.eq("project_id", projectId);

  const { data: issues } = await q;
  const rows = issues ?? [];

  // Also fetch done issues in range (closed_at approximated by updated_at when status=done)
  let doneQ = supabase
    .from("issues")
    .select("id, updated_at")
    .eq("tenant_id", tenantId)
    .eq("status", "done")
    .gte("updated_at", from.toISOString())
    .lte("updated_at", to.toISOString());
  if (projectId) doneQ = doneQ.eq("project_id", projectId);
  const { data: doneIssues } = await doneQ;
  const doneRows = doneIssues ?? [];

  // Status breakdown
  const statusMap: Record<string, number> = {};
  for (const r of rows) {
    statusMap[r.status] = (statusMap[r.status] ?? 0) + 1;
  }
  const byStatus: StatusCount[] = Object.entries(statusMap).map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // Priority breakdown
  const priMap: Record<string, number> = {};
  for (const r of rows) {
    priMap[r.priority] = (priMap[r.priority] ?? 0) + 1;
  }
  const byPriority: PriorityCount[] = Object.entries(priMap).map(([priority, count]) => ({ priority, count }))
    .sort((a, b) => b.count - a.count);

  // Assignee breakdown — top 10 open only
  const openIssues = rows.filter((r) => r.status !== "done");
  const assigneeMap: Record<string, number> = {};
  for (const r of openIssues) {
    const key = r.assignee_id ?? "__unassigned__";
    assigneeMap[key] = (assigneeMap[key] ?? 0) + 1;
  }
  const topAssigneeIds = Object.entries(assigneeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);

  // Fetch assignee names
  const userIds = topAssigneeIds.filter((id) => id !== "__unassigned__");
  const nameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const svc = createSupabaseServiceClient();
    const { data: users } = await svc.from("users").select("id, name, email").in("id", userIds);
    for (const u of users ?? []) {
      nameMap[u.id] = u.name ?? u.email ?? u.id;
    }
  }

  const byAssignee: AssigneeCount[] = topAssigneeIds.map((id) => ({
    assigneeId: id === "__unassigned__" ? null : id,
    name: id === "__unassigned__" ? "Unassigned" : (nameMap[id] ?? "Unknown"),
    count: assigneeMap[id],
  }));

  // Weekly trend: opened vs closed per ISO week in range
  const weekMap: Map<string, { opened: number; closed: number }> = new Map();
  function isoWeekLabel(d: Date): string {
    const day = new Date(d);
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((day.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `W${week}`;
  }

  for (const r of rows) {
    const wk = isoWeekLabel(new Date(r.created_at));
    const entry = weekMap.get(wk) ?? { opened: 0, closed: 0 };
    entry.opened++;
    weekMap.set(wk, entry);
  }
  for (const r of doneRows) {
    const wk = isoWeekLabel(new Date(r.updated_at));
    const entry = weekMap.get(wk) ?? { opened: 0, closed: 0 };
    entry.closed++;
    weekMap.set(wk, entry);
  }

  const weeklyTrend: WeekPoint[] = Array.from(weekMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, v]) => ({ label, ...v }));

  const projects = await projectsRepo(supabase).listByTenant(tenantId);
  const totalOpen = rows.filter((r) => r.status !== "done").length;
  const totalDone = doneRows.length;

  return { totalOpen, totalDone, byStatus, byPriority, byAssignee, weeklyTrend, projects };
}
