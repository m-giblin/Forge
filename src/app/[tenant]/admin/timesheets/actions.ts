"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: admin timesheet ops bypass RLS (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type TimesheetRow = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  weekStart: string;
  status: string;
  totalMinutes: number;
  submittedAt: string | null;
  reviewerNotes: string | null;
};

export async function getAdminTimesheetsAction(
  slug: string,
  weekStart?: string,
): Promise<TimesheetRow[]> {
  const ctx = await getTenantContext(slug);
  if (!ctx || (ctx.role !== "owner" && ctx.role !== "admin")) return [];
  const svc = createSupabaseServiceClient();

  let q = svc
    .from("timesheet_submissions")
    .select("id, user_id, week_start, status, total_minutes, submitted_at, reviewer_notes, users!inner(name, email)")
    .eq("tenant_id", ctx.tenant.id)
    .neq("status", "draft")
    .order("submitted_at", { ascending: false })
    .limit(100);

  if (weekStart) q = q.eq("week_start", weekStart);

  const { data } = await q;

  return (data ?? []).map((r) => {
    const u = r.users as unknown as { name: string | null; email: string | null };
    return {
      id: r.id as string,
      userId: r.user_id as string,
      userName: u.name ?? u.email ?? "Unknown",
      userEmail: u.email ?? "",
      weekStart: r.week_start as string,
      status: r.status as string,
      totalMinutes: (r.total_minutes as number) ?? 0,
      submittedAt: r.submitted_at as string | null,
      reviewerNotes: r.reviewer_notes as string | null,
    };
  });
}

export async function reviewTimesheetAction(
  slug: string,
  submissionId: string,
  action: "approved" | "rejected",
  notes?: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx || (ctx.role !== "owner" && ctx.role !== "admin")) return { ok: false, error: "Not authorized" };
  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("timesheet_submissions")
    .update({
      status: action,
      reviewed_by: ctx.appUserId,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", submissionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${slug}/admin/timesheets`);
  return { ok: true };
}
