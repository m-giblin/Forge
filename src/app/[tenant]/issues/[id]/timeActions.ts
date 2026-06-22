"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot log time.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("issue_time_logs").insert({
    tenant_id: ctx.tenant.id,
    issue_id: issueId,
    user_id: ctx.appUserId,
    minutes,
    note: note.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/${slug}/issues/${issueId}`);
}

export async function deleteTimeLogAction(slug: string, logId: string, issueId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("issue_time_logs")
    .delete()
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", logId)
    .eq("user_id", ctx.appUserId);
  if (error) throw new Error(error.message);
  revalidatePath(`/${slug}/issues/${issueId}`);
}
