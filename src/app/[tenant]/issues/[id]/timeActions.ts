"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- service-role: time log writes bypass RLS (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { activeTimersRepo } from "@/lib/repositories/activeTimers";

export type TimeLog = {
  id: string;
  minutes: number;
  note: string | null;
  logged_at: string;
  user_name: string | null;
};

export async function listTimeLogsAction(slug: string, issueId: string): Promise<TimeLog[]> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("issue_time_logs")
    .select("id, minutes, note, logged_at, users(name)")
    .eq("tenant_id", ctx.tenant.id)
    .eq("issue_id", issueId)
    .order("logged_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    minutes: r.minutes as number,
    note: r.note as string | null,
    logged_at: r.logged_at as string,
    user_name: (Array.isArray(r.users) ? (r.users[0] as { name: string | null } | undefined)?.name : (r.users as { name: string | null } | null)?.name) ?? null,
  }));
}

export async function logTimeAction(
  slug: string,
  issueId: string,
  minutes: number,
  note: string,
  billable?: boolean,
  tag?: string | null,
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot log time.");
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("issue_time_logs").insert({
    tenant_id: ctx.tenant.id,
    issue_id: issueId,
    user_id: ctx.appUserId,
    minutes,
    note: note.trim() || null,
    billable: billable ?? false,
    tag: tag ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/${slug}/issues/${issueId}`);
}

export async function deleteTimeLogAction(slug: string, logId: string, issueId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("issue_time_logs")
    .delete()
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", logId)
    .eq("user_id", ctx.appUserId);
  if (error) throw new Error(error.message);
  revalidatePath(`/${slug}/issues/${issueId}`);
}

export async function startIssueTimerAction(
  slug: string,
  issueId: string,
): Promise<{ ok: boolean; startedAt?: string; error?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return { ok: false, error: "Not authorized" };
  if (ctx.role === "viewer") return { ok: false, error: "Viewers cannot log time." };
  try {
    const svc = createSupabaseServiceClient();
    const timer = await activeTimersRepo(svc).start(ctx.tenant.id, ctx.appUserId, issueId);
    revalidatePath(`/${slug}/issues/${issueId}`);
    return { ok: true, startedAt: timer.started_at };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function stopIssueTimerAction(
  slug: string,
  issueId: string,
): Promise<{ ok: boolean; minutesLogged?: number; note?: string; error?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return { ok: false, error: "Not authorized" };
  try {
    const svc = createSupabaseServiceClient();
    const timer = await activeTimersRepo(svc).stop(ctx.tenant.id, ctx.appUserId);
    if (!timer) return { ok: true, minutesLogged: 0 };
    const elapsedMs = Date.now() - new Date(timer.started_at).getTime();
    const elapsedSecs = Math.round(elapsedMs / 1000);
    const minutes = Math.max(1, Math.round(elapsedMs / 60000));
    const autoNote = elapsedSecs < 60
      ? `Timer · ${elapsedSecs}s`
      : `Timer · ${Math.floor(elapsedSecs / 60)}m ${elapsedSecs % 60}s`;
    if (timer.issue_id === issueId) {
      await svc.from("issue_time_logs").insert({
        tenant_id: ctx.tenant.id,
        issue_id: timer.issue_id,
        user_id: ctx.appUserId,
        minutes,
        note: autoNote,
        logged_at: new Date().toISOString().slice(0, 10),
      });
    }
    revalidatePath(`/${slug}/issues/${issueId}`);
    return { ok: true, minutesLogged: timer.issue_id === issueId ? minutes : 0, note: autoNote };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getIssueTimerAction(
  slug: string,
  issueId: string,
): Promise<{ active: boolean; startedAt?: string } | null> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return null;
  const svc = createSupabaseServiceClient();
  const timer = await activeTimersRepo(svc).getForUser(ctx.tenant.id, ctx.appUserId);
  if (!timer || timer.issue_id !== issueId) return { active: false };
  return { active: true, startedAt: timer.started_at };
}

export async function updateTimeEstimateAction(
  slug: string,
  issueId: string,
  minutes: number | null,
): Promise<{ ok: boolean }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return { ok: false };
  if (ctx.role === "viewer") return { ok: false };
  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("issues")
    .update({ time_estimate_minutes: minutes })
    .eq("id", issueId)
    .eq("tenant_id", ctx.tenant.id);
  if (error) return { ok: false };
  revalidatePath(`/${slug}/issues/${issueId}`);
  return { ok: true };
}
