"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: sign-off writes need to bypass user RLS
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function addSignoffRoleAction(slug: string, issueId: string, roleLabel: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Only owners and admins can configure required sign-offs.");

  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("issue_signoffs")
    .insert({ tenant_id: ctx.tenant.id, issue_id: issueId, role_label: roleLabel.trim() });
  if (error) {
    if (error.code === "23505") throw new Error(`A sign-off for "${roleLabel}" already exists on this issue.`);
    throw error;
  }
  revalidatePath(`/${slug}/issues/${issueId}`);
}

export async function signIssueAction(slug: string, signoffId: string, issueId: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot approve sign-offs.");

  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("issue_signoffs")
    .update({ signed_by: ctx.appUserId, signed_at: new Date().toISOString() })
    .eq("id", signoffId)
    .eq("tenant_id", ctx.tenant.id);
  if (error) throw error;
  revalidatePath(`/${slug}/issues/${issueId}`);
}

export async function unsignIssueAction(slug: string, signoffId: string, issueId: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");

  const svc = createSupabaseServiceClient();
  // Only the signer or an admin can revoke
  const { data: row } = await svc.from("issue_signoffs").select("signed_by").eq("id", signoffId).single();
  if (row?.signed_by !== ctx.appUserId && ctx.role !== "owner" && ctx.role !== "admin") {
    throw new Error("You can only revoke your own approval.");
  }
  const { error } = await svc
    .from("issue_signoffs")
    .update({ signed_by: null, signed_at: null })
    .eq("id", signoffId)
    .eq("tenant_id", ctx.tenant.id);
  if (error) throw error;
  revalidatePath(`/${slug}/issues/${issueId}`);
}

export async function removeSignoffRoleAction(slug: string, signoffId: string, issueId: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Only owners and admins can remove sign-off requirements.");

  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("issue_signoffs").delete().eq("id", signoffId).eq("tenant_id", ctx.tenant.id);
  if (error) throw error;
  revalidatePath(`/${slug}/issues/${issueId}`);
}
