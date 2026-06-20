"use server";

import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notificationsRepo } from "@/lib/repositories/notifications";

export async function markAllReadAction(slug: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const supabase = await createSupabaseServerClient();
  await notificationsRepo(supabase).markAllRead(ctx.appUserId);
}

export async function setEmailDigestAction(slug: string, enabled: boolean) {
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const supabase = await createSupabaseServerClient();
  // Best-effort — column may not exist until migration 0042 runs.
  try {
    await supabase
      .from("users")
      .update({ email_digest: enabled })
      .eq("id", ctx.appUserId);
  } catch { /* ignore — column may not exist pre-migration */ }
}
