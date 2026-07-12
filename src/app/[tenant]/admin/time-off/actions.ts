"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: admin time-off ops bypass RLS (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type TimeOffRow = {
  id: string;
  userId: string;
  userName: string;
  type: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  status: string;
  notes: string | null;
  reviewNotes: string | null;
  createdAt: string;
};

export async function getAdminTimeOffAction(
  slug: string,
  statusFilter?: string,
): Promise<TimeOffRow[]> {
  const ctx = await getTenantContext(slug);
  if (!ctx || (ctx.role !== "owner" && ctx.role !== "admin")) return [];
  const svc = createSupabaseServiceClient();

  let q = svc
    .from("time_off_requests")
    .select("id, user_id, type, start_date, end_date, days_count, status, notes, review_notes, created_at, users!inner(name, email)")
    .eq("tenant_id", ctx.tenant.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (statusFilter && statusFilter !== "all") q = q.eq("status", statusFilter);

  const { data } = await q;
  return (data ?? []).map((r) => {
    const u = r.users as unknown as { name: string | null; email: string | null };
    return {
      id: r.id as string,
      userId: r.user_id as string,
      userName: u.name ?? u.email ?? "Unknown",
      type: r.type as string,
      startDate: r.start_date as string,
      endDate: r.end_date as string,
      daysCount: r.days_count as number,
      status: r.status as string,
      notes: r.notes as string | null,
      reviewNotes: r.review_notes as string | null,
      createdAt: r.created_at as string,
    };
  });
}

export async function reviewTimeOffAction(
  slug: string,
  requestId: string,
  action: "approved" | "rejected",
  reviewNotes?: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx || (ctx.role !== "owner" && ctx.role !== "admin")) return { ok: false, error: "Not authorized" };
  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("time_off_requests")
    .update({
      status: action,
      reviewed_by: ctx.appUserId,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes?.trim() || null,
    })
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", requestId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${slug}/admin/time-off`);
  return { ok: true };
}
