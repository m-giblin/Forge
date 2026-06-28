"use server";

import { getTenantContext } from "@/lib/auth";
import { redirect } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- server action: service-role required for cross-table time reporting (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type TimeReportMember = {
  userId: string;
  name: string;
  totalMinutes: number;
  billableMinutes: number;
  logCount: number;
};

export type TimeReportProject = {
  projectId: string;
  projectName: string;
  projectKey: string;
  totalMinutes: number;
  billableMinutes: number;
};

export type TimeReportDayPoint = {
  date: string; // YYYY-MM-DD
  minutes: number;
};

export type TimeReportLog = {
  logId: string;
  userId: string;
  userName: string;
  issueId: string;
  issueKey: string;
  issueTitle: string;
  projectKey: string;
  minutes: number;
  billable: boolean;
  tag: string | null;
  loggedAt: string;
  note: string | null;
};

export type TimeReportSprint = {
  id: string;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  projectId: string;
  projectKey: string;
};

export type TimeReportData = {
  members: TimeReportMember[];
  projects: TimeReportProject[];
  dailyTrend: TimeReportDayPoint[];
  logs: TimeReportLog[];
  totalMinutes: number;
  billableMinutes: number;
  sprints: TimeReportSprint[];
};

export async function loadTimeReportData(
  slug: string,
  mode: "sprint" | "week" | "month" | "custom",
  sprintId: string | null,
  customFrom: string | null,
  customTo: string | null,
): Promise<TimeReportData> {
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const svc = createSupabaseServiceClient();

  // Load all sprints for the filter dropdown
  const { data: sprintRows } = await svc
    .from("sprints")
    .select("id, name, status, start_date, end_date, project_id, projects!inner(key)")
    .eq("tenant_id", ctx.tenant.id)
    .in("status", ["active", "completed"])
    .order("start_date", { ascending: false })
    .limit(20);

  const sprints: TimeReportSprint[] = (sprintRows ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    status: s.status as string,
    startDate: s.start_date as string | null,
    endDate: s.end_date as string | null,
    projectId: s.project_id as string,
    projectKey: (s.projects as unknown as { key: string }).key,
  }));

  // Determine date range
  let fromIso: string;
  let toIso: string;
  let issueIdsFilter: string[] | null = null;

  const now = new Date();

  if (mode === "sprint" && sprintId) {
    // Load sprint issue IDs to filter time logs
    const { data: issueRows } = await svc
      .from("issues")
      .select("id")
      .eq("tenant_id", ctx.tenant.id)
      .eq("sprint_id", sprintId);
    issueIdsFilter = (issueRows ?? []).map((r) => r.id as string);

    const sprint = sprints.find((s) => s.id === sprintId);
    fromIso = sprint?.startDate ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    toIso = sprint?.endDate ? new Date(sprint.endDate + "T23:59:59Z").toISOString() : now.toISOString();
  } else if (mode === "week") {
    const dayOfWeek = now.getUTCDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - daysFromMonday);
    monday.setUTCHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    sunday.setUTCHours(23, 59, 59, 999);
    fromIso = monday.toISOString();
    toIso = sunday.toISOString();
  } else if (mode === "month") {
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    fromIso = firstOfMonth.toISOString();
    toIso = lastOfMonth.toISOString();
  } else {
    fromIso = customFrom ? new Date(customFrom).toISOString() : new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    toIso = customTo ? new Date(customTo + "T23:59:59Z").toISOString() : now.toISOString();
  }

  // Load time logs with issue + project + user info
  let logsQuery = svc
    .from("issue_time_logs")
    .select("id, user_id, issue_id, minutes, billable, tag, logged_at, note, issues!inner(title, number, project_id, projects!inner(key, name)), users!inner(name, email)")
    .eq("tenant_id", ctx.tenant.id)
    .gte("logged_at", fromIso)
    .lte("logged_at", toIso)
    .order("logged_at", { ascending: false });

  if (issueIdsFilter !== null) {
    if (issueIdsFilter.length === 0) {
      // Sprint exists but has no issues
      return { members: [], projects: [], dailyTrend: [], logs: [], totalMinutes: 0, billableMinutes: 0, sprints };
    }
    logsQuery = logsQuery.in("issue_id", issueIdsFilter);
  }

  const { data: rawLogs } = await logsQuery.limit(500);

  const logs: TimeReportLog[] = (rawLogs ?? []).map((row) => {
    const userRow = row.users as unknown as { name: string | null; email: string | null };
    const issueRow = row.issues as unknown as { title: string; number: number; project_id: string; projects: { key: string; name: string } };

    const userName = userRow.name ?? userRow.email?.split("@")[0] ?? "Unknown";

    return {
      logId: row.id as string,
      userId: row.user_id as string,
      userName,
      issueId: row.issue_id as string,
      issueKey: `${issueRow.projects.key}-${issueRow.number}`,
      issueTitle: issueRow.title as string,
      projectKey: issueRow.projects.key,
      minutes: row.minutes as number,
      billable: (row.billable as boolean) ?? false,
      tag: row.tag as string | null,
      loggedAt: row.logged_at as string,
      note: row.note as string | null,
    };
  });

  // Aggregate by member
  const memberMap = new Map<string, TimeReportMember>();
  for (const log of logs) {
    const existing = memberMap.get(log.userId);
    if (existing) {
      existing.totalMinutes += log.minutes;
      if (log.billable) existing.billableMinutes += log.minutes;
      existing.logCount++;
    } else {
      memberMap.set(log.userId, {
        userId: log.userId,
        name: log.userName,
        totalMinutes: log.minutes,
        billableMinutes: log.billable ? log.minutes : 0,
        logCount: 1,
      });
    }
  }
  const members = Array.from(memberMap.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);

  // Aggregate by project
  const projectMap = new Map<string, TimeReportProject>();
  for (const log of logs) {
    // Find project name from raw logs
    const rawLog = (rawLogs ?? []).find((r) => r.id === log.logId);
    const issueRow = rawLog?.issues as unknown as { projects: { key: string; name: string }; project_id: string } | undefined;
    const projectId = issueRow?.project_id ?? log.projectKey;
    const projectKey = log.projectKey;
    const projectName = issueRow?.projects?.name ?? projectKey;

    const existing = projectMap.get(projectKey);
    if (existing) {
      existing.totalMinutes += log.minutes;
      if (log.billable) existing.billableMinutes += log.minutes;
    } else {
      projectMap.set(projectKey, {
        projectId: projectId as string,
        projectName,
        projectKey,
        totalMinutes: log.minutes,
        billableMinutes: log.billable ? log.minutes : 0,
      });
    }
  }
  const projects = Array.from(projectMap.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);

  // Daily trend
  const dayMap = new Map<string, number>();
  for (const log of logs) {
    const day = log.loggedAt.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + log.minutes);
  }
  const dailyTrend: TimeReportDayPoint[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, minutes]) => ({ date, minutes }));

  const totalMinutes = logs.reduce((s, l) => s + l.minutes, 0);
  const billableMinutes = logs.reduce((s, l) => s + (l.billable ? l.minutes : 0), 0);

  return { members, projects, dailyTrend, logs, totalMinutes, billableMinutes, sprints };
}

export type SprintRollupRow = {
  sprintId: string;
  sprintName: string;
  projectKey: string;
  startDate: string | null;
  endDate: string | null;
  totalMinutes: number;
  topContributor: string | null;
};

export async function loadSprintRollupAction(slug: string): Promise<SprintRollupRow[]> {
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const svc = createSupabaseServiceClient();

  const { data: sprintRows } = await svc
    .from("sprints")
    .select("id, name, status, start_date, end_date, project_id, projects!inner(key)")
    .eq("tenant_id", ctx.tenant.id)
    .in("status", ["active", "completed"])
    .order("start_date", { ascending: false })
    .limit(30);

  if (!sprintRows || sprintRows.length === 0) return [];

  const results: SprintRollupRow[] = [];

  for (const sprint of sprintRows) {
    const { data: issueRows } = await svc
      .from("issues")
      .select("id")
      .eq("tenant_id", ctx.tenant.id)
      .eq("sprint_id", sprint.id as string);

    const issueIds = (issueRows ?? []).map((r) => r.id as string);
    if (issueIds.length === 0) {
      results.push({
        sprintId: sprint.id as string,
        sprintName: sprint.name as string,
        projectKey: (sprint.projects as unknown as { key: string }).key,
        startDate: sprint.start_date as string | null,
        endDate: sprint.end_date as string | null,
        totalMinutes: 0,
        topContributor: null,
      });
      continue;
    }

    const { data: logRows } = await svc
      .from("issue_time_logs")
      .select("user_id, minutes, users!inner(name, email)")
      .eq("tenant_id", ctx.tenant.id)
      .in("issue_id", issueIds);

    const total = (logRows ?? []).reduce((s, r) => s + (r.minutes as number), 0);

    const byUser = new Map<string, { name: string; minutes: number }>();
    for (const r of logRows ?? []) {
      const uid = r.user_id as string;
      const userRow = r.users as unknown as { name: string | null; email: string | null };
      const name = userRow.name ?? userRow.email?.split("@")[0] ?? "Unknown";
      const existing = byUser.get(uid);
      if (existing) { existing.minutes += r.minutes as number; }
      else { byUser.set(uid, { name, minutes: r.minutes as number }); }
    }
    const top = byUser.size > 0
      ? [...byUser.values()].sort((a, b) => b.minutes - a.minutes)[0].name
      : null;

    results.push({
      sprintId: sprint.id as string,
      sprintName: sprint.name as string,
      projectKey: (sprint.projects as unknown as { key: string }).key,
      startDate: sprint.start_date as string | null,
      endDate: sprint.end_date as string | null,
      totalMinutes: total,
      topContributor: top,
    });
  }

  return results;
}
