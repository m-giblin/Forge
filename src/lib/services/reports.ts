import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { projectsRepo } from "@/lib/repositories/projects";
import type { Project } from "@/lib/services/issues";

export type StatusCount = { status: string; count: number };
export type PriorityCount = { priority: string; count: number };
export type AssigneeCount = { assigneeId: string | null; name: string; count: number };
export type WeekPoint = { label: string; opened: number; closed: number };
export type TypeCount = { type: string; count: number };
export type BlockedIssue = { id: string; key: string; title: string; daysOld: number; assigneeName: string };
export type CycleStage = { label: string; avgDays: number };

export type ReportsData = {
  totalOpen: number;
  totalDone: number;
  byStatus: StatusCount[];
  byPriority: PriorityCount[];
  byAssignee: AssigneeCount[];
  weeklyTrend: WeekPoint[];
  projects: Project[];
  // New widgets
  byType: TypeCount[];
  avgCycleDays: number | null;
  cycleByStage: CycleStage[];
  blockedIssues: BlockedIssue[];
  blockedDaysTotal: number;
  openCount: number;
  closedCount: number;
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
    .select("id, number, title, status, priority, type, assignee_id, labels, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString());

  if (projectId) q = q.eq("project_id", projectId);

  const { data: issues } = await q;
  const rows = issues ?? [];

  // Also fetch done issues in range (closed_at approximated by updated_at when status=done)
  let doneQ = supabase
    .from("issues")
    .select("id, created_at, updated_at")
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

  // ── Bug vs Feature vs Task breakdown ──
  const typeMap: Record<string, number> = {};
  for (const r of rows) {
    const t = (r.type as string) ?? "task";
    typeMap[t] = (typeMap[t] ?? 0) + 1;
  }
  const byType: TypeCount[] = Object.entries(typeMap)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // ── Cycle time: avg days created→done for done issues ──
  const MS_DAY = 86_400_000;
  const doneWithDuration = doneRows
    .map((r) => ({ days: (new Date(r.updated_at).getTime() - new Date(r.created_at ?? r.updated_at).getTime()) / MS_DAY }))
    .filter((d) => d.days >= 0 && d.days < 365);

  const avgCycleDays =
    doneWithDuration.length > 0
      ? Math.round((doneWithDuration.reduce((s, d) => s + d.days, 0) / doneWithDuration.length) * 10) / 10
      : null;

  // Approximate cycle stage breakdown from current status distribution
  const stageIssues = rows.filter((r) => r.status !== "done");
  const stageDays = (status: string) => {
    const s = stageIssues.filter((r) => r.status === status);
    if (s.length === 0) return 0;
    return Math.round((s.reduce((sum, r) => sum + (Date.now() - new Date(r.updated_at).getTime()) / MS_DAY, 0) / s.length) * 10) / 10;
  };
  const cycleByStage: CycleStage[] = [
    { label: "Todo → In Progress", avgDays: stageDays("todo") },
    { label: "In Progress → Review", avgDays: stageDays("in_progress") },
    { label: "Review → Done", avgDays: stageDays("in_review") },
  ].filter((s) => s.avgDays > 0);

  // ── Blocked issues ──
  const blockedRows = rows.filter(
    (r) => r.status === "blocked" || (r.labels as string[] | null ?? []).some((l: string) => l.toLowerCase().includes("block")),
  );

  // Fetch assignee names for blocked issues
  const blockedAssigneeIds = [...new Set(blockedRows.map((r) => r.assignee_id).filter(Boolean) as string[])];
  const blockedNameMap: Record<string, string> = {};
  if (blockedAssigneeIds.length > 0) {
    const svc2 = createSupabaseServiceClient();
    const { data: bu } = await svc2.from("users").select("id, name, email").in("id", blockedAssigneeIds);
    for (const u of bu ?? []) blockedNameMap[u.id] = u.name ?? u.email ?? u.id;
  }

  // Also fetch issue keys (project key + number) for blocked issues
  const blockedIssueIds = blockedRows.map((r) => r.id);
  let blockedIssues: BlockedIssue[] = [];
  if (blockedIssueIds.length > 0) {
    const { data: bWithProj } = await supabase
      .from("issues")
      .select("id, number, title, assignee_id, created_at, project:project_id(key)")
      .in("id", blockedIssueIds);
    blockedIssues = (bWithProj ?? []).map((r) => ({
      id: r.id,
      key: `${(r.project as unknown as { key: string } | null)?.key ?? "??"}-${r.number}`,
      title: r.title as string,
      daysOld: Math.floor((Date.now() - new Date(r.created_at as string).getTime()) / MS_DAY),
      assigneeName: r.assignee_id ? (blockedNameMap[r.assignee_id as string] ?? "Unknown") : "Unassigned",
    }));
  }

  const blockedDaysTotal = blockedIssues.reduce((s, i) => s + i.daysOld, 0);
  const openCount = totalOpen;
  const closedCount = totalDone;

  return {
    totalOpen, totalDone, byStatus, byPriority, byAssignee, weeklyTrend, projects,
    byType, avgCycleDays, cycleByStage, blockedIssues, blockedDaysTotal, openCount, closedCount,
  };
}
