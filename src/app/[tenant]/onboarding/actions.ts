"use server";
import { getTenantContext } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function completeOnboardingAction(slug: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const supabase = await createSupabaseServerClient();
  try {
    await supabase.from("users").update({ onboarding_done: true }).eq("id", ctx.appUserId);
  } catch { /* ignore */ }
  redirect(`/${slug}`);
}

export async function claimFirstIssueAction(slug: string, issueId: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const supabase = await createSupabaseServerClient();
  await supabase.from("issues").update({ assignee_id: ctx.appUserId }).eq("id", issueId).eq("tenant_id", ctx.tenant.id);
  try {
    await supabase.from("users").update({ onboarding_done: true }).eq("id", ctx.appUserId);
  } catch { /* ignore */ }
  redirect(`/${slug}`);
}
