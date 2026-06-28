"use server";

import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: recurring_time_entries ops
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type RecurringEntry = {
  id: string;
  issueId: string;
  issueNumber: number | null;
  issueTitle: string;
  projectId: string | null;
  projectKey: string | null;
  minutes: number;
  note: string | null;
  billable: boolean;
  tag: string | null;
  frequency: "daily" | "weekly";
  daysOfWeek: number[];
  active: boolean;
  createdAt: string;
};

export async function getRecurringEntriesAction(slug: string): Promise<RecurringEntry[]> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return [];
  const svc = createSupabaseServiceClient();
  const { data, error } = await svc
    .from("recurring_time_entries")
    .select("id, issue_id, minutes, note, billable, tag, frequency, days_of_week, active, created_at, issues(id, number, title, project_id, projects(id, key))")
    .eq("tenant_id", ctx.tenant.id)
    .eq("user_id", ctx.appUserId)
    .order("created_at", { ascending: false });
  if (error) console.error("[getRecurringEntriesAction]", error.message);
  return (data ?? []).map((r) => {
    const issue = r.issues as unknown as { id: string; number: number | null; title: string; project_id: string | null; projects: { id: string; key: string } | null } | null;
    return {
      id: r.id as string,
      issueId: r.issue_id as string,
      issueNumber: issue?.number ?? null,
      issueTitle: issue?.title ?? r.issue_id as string,
      projectId: issue?.project_id ?? null,
      projectKey: issue?.projects?.key ?? null,
      minutes: r.minutes as number,
      note: r.note as string | null,
      billable: (r.billable as boolean) ?? false,
      tag: r.tag as string | null,
      frequency: r.frequency as "daily" | "weekly",
      daysOfWeek: (r.days_of_week as number[]) ?? [],
      active: (r.active as boolean) ?? true,
      createdAt: r.created_at as string,
    };
  });
}

export async function createRecurringEntryAction(
  slug: string,
  issueId: string,
  minutes: number,
  note: string | null,
  billable: boolean,
  tag: string | null,
  frequency: "daily" | "weekly",
  daysOfWeek: number[],
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return { ok: false, error: "Not authorized" };
  if (ctx.role === "viewer") return { ok: false, error: "Viewers cannot create recurring entries." };
  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("recurring_time_entries").insert({
    tenant_id: ctx.tenant.id,
    user_id: ctx.appUserId,
    issue_id: issueId,
    minutes,
    note: note?.trim() || null,
    billable,
    tag: tag?.trim() || null,
    frequency,
    days_of_week: daysOfWeek,
    active: true,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function toggleRecurringEntryAction(
  slug: string,
  id: string,
  active: boolean,
): Promise<{ ok: boolean }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return { ok: false };
  const svc = createSupabaseServiceClient();
  await svc
    .from("recurring_time_entries")
    .update({ active })
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.id)
    .eq("user_id", ctx.appUserId);
  return { ok: true };
}

export async function deleteRecurringEntryAction(
  slug: string,
  id: string,
): Promise<{ ok: boolean }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return { ok: false };
  const svc = createSupabaseServiceClient();
  await svc
    .from("recurring_time_entries")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.id)
    .eq("user_id", ctx.appUserId);
  return { ok: true };
}

export async function searchIssuesForRecurringAction(
  slug: string,
  q: string,
): Promise<Array<{ id: string; title: string; number: number; projectKey: string }>> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return [];
  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("issues")
    .select("id, title, number, projects!inner(key)")
    .eq("tenant_id", ctx.tenant.id)
    .or(`title.ilike.%${q}%`)
    .limit(10);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    number: r.number as number,
    projectKey: (r.projects as unknown as { key: string }).key,
  }));
}
