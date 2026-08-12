"use server";

import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { AVATAR_COLOR_CHOICES } from "@/lib/ui/avatar";

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

export async function saveAvatarColorAction(slug: string, color: string | null) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized");
  if (color !== null && !AVATAR_COLOR_CHOICES.includes(color)) throw new Error("Invalid color");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("users")
    .update({ avatar_color: color })
    .eq("id", ctx.appUserId);
  if (error) throw error;
  revalidatePath(`/${slug}/settings`);
}
