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
    .select("id, key, title, project_id")
    .in("id", issueIds)
    .eq("tenant_id", ctx.tenant.id);

  const projectIds = [...new Set((issues ?? []).map((i) => i.project_id as string).filter(Boolean))];
  let projectMap = new Map<string, string>();
  if (projectIds.length > 0) {
    const { data: projects } = await svc.from("projects").select("id, name").in("id", projectIds);
    projectMap = new Map((projects ?? []).map((p) => [p.id as string, p.name as string]));
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
    const projectName = issue?.project_id ? (projectMap.get(issue.project_id as string) ?? null) : null;
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
    return {
      issueId,
      issueKey: (issue?.key as string | null) ?? null,
      issueTitle: (issue?.title as string) ?? issueId,
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
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return { ok: false, error: "Not authorized" };
  if (ctx.role === "viewer") return { ok: false, error: "Viewers cannot log time." };
  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("issue_time_logs").insert({
    tenant_id: ctx.tenant.id,
    issue_id: issueId,
    user_id: ctx.appUserId,
    minutes,
    note: note?.trim() || null,
    logged_at: date,
    billable: billable ?? false,
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
