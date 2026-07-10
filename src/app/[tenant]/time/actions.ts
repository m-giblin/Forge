"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: ops layer time actions bypass RLS
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { activeTimersRepo } from "@/lib/repositories/activeTimers";

export async function getActiveTimerAction(
  slug: string,
): Promise<{ issueId: string; issueName: string | null; issueKey: string | null; startedAt: string } | null> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return null;
  const svc = createSupabaseServiceClient();
  const timer = await activeTimersRepo(svc).getForUser(ctx.tenant.id, ctx.appUserId);
  if (!timer) return null;
  const { data: issue } = await svc
    .from("issues")
    .select("id, title, key")
    .eq("id", timer.issue_id)
    .eq("tenant_id", ctx.tenant.id)
    .maybeSingle();
  return {
    issueId: timer.issue_id,
    issueName: issue?.title ?? null,
    issueKey: issue?.key ?? null,
    startedAt: timer.started_at,
  };
}

export async function startTimerAction(
  slug: string,
  issueId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return { ok: false, error: "Not authorized" };
  if (ctx.role === "viewer") return { ok: false, error: "Viewers cannot log time." };
  try {
    const svc = createSupabaseServiceClient();
    // F-02: issueId was never verified to belong to this tenant before —
    // an authed user could start a timer against another tenant's issue UUID.
    const { data: issue } = await svc.from("issues").select("id").eq("id", issueId).eq("tenant_id", ctx.tenant.id).maybeSingle();
    if (!issue) return { ok: false, error: "Issue not found." };
    await activeTimersRepo(svc).start(ctx.tenant.id, ctx.appUserId, issueId);
    revalidatePath(`/${slug}/time`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function stopTimerAction(
  slug: string,
): Promise<{ ok: boolean; minutesLogged?: number; error?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return { ok: false, error: "Not authorized" };
  try {
    const svc = createSupabaseServiceClient();
    const timer = await activeTimersRepo(svc).stop(ctx.tenant.id, ctx.appUserId);
    if (!timer) return { ok: true, minutesLogged: 0 };
    const minutes = Math.max(1, Math.round((Date.now() - new Date(timer.started_at).getTime()) / 60000));
    await svc.from("issue_time_logs").insert({
      tenant_id: ctx.tenant.id,
      issue_id: timer.issue_id,
      user_id: ctx.appUserId,
      minutes,
      logged_at: new Date().toISOString().slice(0, 10),
    });
    revalidatePath(`/${slug}/time`);
    return { ok: true, minutesLogged: minutes };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getWeeklyTimesheetAction(
  slug: string,
  weekStart: string,
): Promise<{
  entries: Array<{
    issueId: string;
    issueKey: string | null;
    issueTitle: string;
    projectName: string | null;
    logs: Array<{ id: string; date: string; minutes: number; note: string | null; billable: boolean }>;
  }>;
  totalMinutes: number;
}> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return { entries: [], totalMinutes: 0 };

  const weekEndDate = new Date(weekStart);
  weekEndDate.setDate(weekEndDate.getDate() + 7);
  const weekEnd = weekEndDate.toISOString().slice(0, 10);

  const svc = createSupabaseServiceClient();
  const { data: logs } = await svc
    .from("issue_time_logs")
    .select("id, issue_id, minutes, note, logged_at, billable")
    .eq("tenant_id", ctx.tenant.id)
    .eq("user_id", ctx.appUserId)
    .gte("logged_at", weekStart)
    .lt("logged_at", weekEnd);

  if (!logs || logs.length === 0) return { entries: [], totalMinutes: 0 };

  const issueIds = [...new Set(logs.map((l) => l.issue_id as string))];
  const { data: issues } = await svc
    .from("issues")
    .select("id, number, title, project_id")
    .in("id", issueIds)
    .eq("tenant_id", ctx.tenant.id);

  const projectIds = [...new Set((issues ?? []).map((i) => i.project_id as string).filter(Boolean))];
  let projectMap = new Map<string, { name: string; key: string }>();
  if (projectIds.length > 0) {
    const { data: projects } = await svc.from("projects").select("id, name, key").in("id", projectIds);
    projectMap = new Map((projects ?? []).map((p) => [p.id as string, { name: p.name as string, key: p.key as string }]));
  }

  const issueMap = new Map((issues ?? []).map((i) => [i.id as string, i]));

  const byIssue = new Map<string, typeof logs>();
  for (const log of logs) {
    const issueId = log.issue_id as string;
    if (!byIssue.has(issueId)) byIssue.set(issueId, []);
    byIssue.get(issueId)!.push(log);
  }

  let totalMinutes = 0;
  const entries = [...byIssue.entries()].map(([issueId, issueLogs]) => {
    const issue = issueMap.get(issueId);
    const proj = issue?.project_id ? (projectMap.get(issue.project_id as string) ?? null) : null;
    const projectName = proj?.name ?? null;
    const projectKey = proj?.key ?? null;
    const mappedLogs = issueLogs.map((l) => {
      totalMinutes += l.minutes as number;
      return {
        id: l.id as string,
        date: (l.logged_at as string).slice(0, 10),
        minutes: l.minutes as number,
        note: (l.note as string | null) ?? null,
        billable: (l.billable as boolean) ?? false,
      };
    });
    const issueNumber = issue?.number as number | undefined;
    const issueKey = projectKey && issueNumber != null ? `${projectKey}-${issueNumber}` : null;
    return {
      issueId,
      issueKey,
      issueTitle: (issue?.title as string) ?? issueKey ?? issueId,
      projectName,
      logs: mappedLogs,
    };
  });

  return { entries, totalMinutes };
}

export async function logTimeFromSheetAction(
  slug: string,
  issueId: string,
  date: string,
  minutes: number,
  note?: string,
  billable?: boolean,
  tag?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return { ok: false, error: "Not authorized" };
  if (ctx.role === "viewer") return { ok: false, error: "Viewers cannot log time." };
  const svc = createSupabaseServiceClient();
  // F-02: same ownership check as startTimerAction — issueId must belong to this tenant.
  const { data: issue } = await svc.from("issues").select("id").eq("id", issueId).eq("tenant_id", ctx.tenant.id).maybeSingle();
  if (!issue) return { ok: false, error: "Issue not found." };
  const { error } = await svc.from("issue_time_logs").insert({
    tenant_id: ctx.tenant.id,
    issue_id: issueId,
    user_id: ctx.appUserId,
    minutes,
    note: note?.trim() || null,
    logged_at: date,
    billable: billable ?? false,
    tag: tag ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${slug}/time`);
  return { ok: true };
}

export async function deleteTimeLogFromSheetAction(
  slug: string,
  logId: string,
): Promise<{ ok: boolean }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return { ok: false };
  const svc = createSupabaseServiceClient();
  await svc
    .from("issue_time_logs")
    .delete()
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", logId)
    .eq("user_id", ctx.appUserId);
  revalidatePath(`/${slug}/time`);
  return { ok: true };
}

// ── Premium: Timesheet submission ──────────────────────────────────────────

export async function submitTimesheetAction(
  slug: string,
  weekStart: string,
  totalMinutes: number,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return { ok: false, error: "Not authorized" };
  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("timesheet_submissions").upsert({
    tenant_id: ctx.tenant.id,
    user_id: ctx.appUserId,
    week_start: weekStart,
    status: "submitted",
    submitted_at: new Date().toISOString(),
    total_minutes: totalMinutes,
    updated_at: new Date().toISOString(),
  }, { onConflict: "tenant_id,user_id,week_start" });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${slug}/time`);
  return { ok: true };
}

export async function getTimesheetStatusAction(
  slug: string,
  weekStart: string,
): Promise<{ status: string | null; reviewerNotes: string | null }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return { status: null, reviewerNotes: null };
  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("timesheet_submissions")
    .select("status, reviewer_notes")
    .eq("tenant_id", ctx.tenant.id)
    .eq("user_id", ctx.appUserId)
    .eq("week_start", weekStart)
    .maybeSingle();
  return { status: (data?.status as string | null) ?? null, reviewerNotes: (data?.reviewer_notes as string | null) ?? null };
}

// ── Premium: Time off requests ─────────────────────────────────────────────

export async function requestTimeOffAction(
  slug: string,
  type: string,
  startDate: string,
  endDate: string,
  daysCount: number,
  notes?: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return { ok: false, error: "Not authorized" };
  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("time_off_requests").insert({
    tenant_id: ctx.tenant.id,
    user_id: ctx.appUserId,
    type,
    start_date: startDate,
    end_date: endDate,
    days_count: daysCount,
    notes: notes?.trim() || null,
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${slug}/time`);
  return { ok: true };
}

export async function getMyTimeOffRequestsAction(slug: string): Promise<Array<{
  id: string; type: string; startDate: string; endDate: string; daysCount: number;
  status: string; notes: string | null; createdAt: string;
}>> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return [];
  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("time_off_requests")
    .select("id, type, start_date, end_date, days_count, status, notes, created_at")
    .eq("tenant_id", ctx.tenant.id)
    .eq("user_id", ctx.appUserId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((r) => ({
    id: r.id as string, type: r.type as string,
    startDate: r.start_date as string, endDate: r.end_date as string,
    daysCount: r.days_count as number, status: r.status as string,
    notes: r.notes as string | null, createdAt: r.created_at as string,
  }));
}
