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
