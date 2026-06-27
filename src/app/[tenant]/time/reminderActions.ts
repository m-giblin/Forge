"use server";

import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: reminder settings bypass RLS (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { notificationsRepo } from "@/lib/repositories/notifications";

export async function getTimeReminderSettingAction(slug: string): Promise<boolean> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return true;
  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("tenant_settings")
    .select("value")
    .eq("tenant_id", ctx.tenant.id)
    .eq("key", "time_log_reminders")
    .maybeSingle();
  if (!data) return true;
  return (data.value as string) !== "false";
}

export async function setTimeReminderSettingAction(slug: string, enabled: boolean): Promise<{ ok: boolean }> {
  const ctx = await getTenantContext(slug);
  if (!ctx || (ctx.role !== "owner" && ctx.role !== "admin")) return { ok: false };
  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("tenant_settings")
    .upsert(
      { tenant_id: ctx.tenant.id, key: "time_log_reminders", value: String(enabled) },
      { onConflict: "tenant_id,key" },
    );
  return { ok: !error };
}

export async function checkAndSendTimeReminderAction(slug: string, userId: string): Promise<{ sent: boolean }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return { sent: false };

  const svc = createSupabaseServiceClient();

  const { data: setting } = await svc
    .from("tenant_settings")
    .select("value")
    .eq("tenant_id", ctx.tenant.id)
    .eq("key", "time_log_reminders")
    .maybeSingle();

  if (setting && (setting.value as string) === "false") return { sent: false };

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: recentLogs } = await svc
    .from("time_logs")
    .select("id")
    .eq("tenant_id", ctx.tenant.id)
    .eq("user_id", userId)
    .gte("created_at", cutoff)
    .limit(1);

  if (recentLogs && recentLogs.length > 0) return { sent: false };

  const repo = notificationsRepo(svc);
  await repo.create({
    tenantId: ctx.tenant.id,
    userId,
    type: "info",
    title: "Time logging reminder",
    body: "You haven't logged time in 2 days. Keep your timesheet current.",
    linkPath: `/${slug}/time`,
  });

  return { sent: true };
}
