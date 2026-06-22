"use server";

import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveNotificationPrefsAction(slug: string, prefs: Record<string, boolean>) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("users")
    .update({ notification_prefs: prefs })
    .eq("id", ctx.appUserId);
  if (error) throw error;
  revalidatePath(`/${slug}/settings`);
}
