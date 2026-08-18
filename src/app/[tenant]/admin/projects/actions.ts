"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { addProjectMember, removeProjectMember } from "@/lib/services/projects";
import { recordAudit } from "@/lib/audit";
import { projectsRepo } from "@/lib/repositories/projects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- service-role: tenant_settings write requires bypass of RLS
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ctxCanDo } from "@/lib/rbac";

const DEFAULT_PROJECT_SETTING_KEY = "default_project_id";

function assertAdmin(ctx: { role: string; customRolePermissions: import("@/lib/rbac").RbacPermissionSet | null }) {
  const role = ctx.role as "owner" | "admin" | "member" | "viewer";
  if (role !== "owner" && role !== "admin" && !ctxCanDo(ctx as Parameters<typeof ctxCanDo>[0], "manage_projects")) {
    throw new Error("Only owners and admins manage project teams.");
  }
}

export async function addProjectMemberAction(slug: string, projectId: string, userId: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertAdmin(ctx);
  await addProjectMember(ctx.tenant.id, projectId, userId);
  await recordAudit({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.appUserId,
    action: "project.member_add",
    target: projectId,
    metadata: { userId },
  });
  revalidatePath(`/${slug}/admin/projects`);
}

export async function removeProjectMemberAction(slug: string, projectId: string, userId: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertAdmin(ctx);
  await removeProjectMember(ctx.tenant.id, projectId, userId);
  await recordAudit({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.appUserId,
    action: "project.member_remove",
    target: projectId,
    metadata: { userId },
  });
  revalidatePath(`/${slug}/admin/projects`);
}

// projectId: null clears the default and falls back to alphabetical.
export async function setDefaultProjectAction(slug: string, projectId: string | null) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertAdmin(ctx);
  const svc = createSupabaseServiceClient();
  if (projectId === null) {
    await svc
      .from("tenant_settings")
      .delete()
      .eq("tenant_id", ctx.tenant.id)
      .eq("key", DEFAULT_PROJECT_SETTING_KEY);
  } else {
    const { error } = await svc
      .from("tenant_settings")
      .upsert(
        { tenant_id: ctx.tenant.id, key: DEFAULT_PROJECT_SETTING_KEY, value: projectId, updated_at: new Date().toISOString() },
        { onConflict: "tenant_id,key" }
      );
    if (error) throw error;
  }
  await recordAudit({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.appUserId,
    action: "project.set_default",
    target: projectId ?? "none",
    metadata: {},
  });
  revalidatePath(`/${slug}/admin/projects`);
  revalidatePath(`/${slug}/board`);
}

export async function deleteProjectAction(slug: string, projectId: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Only owners and admins can delete projects.");
  const supabase = await createSupabaseServerClient();
  await projectsRepo(supabase).deleteById(ctx.tenant.id, projectId);
  await recordAudit({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.appUserId,
    action: "project.delete",
    target: projectId,
    metadata: {},
  });
  revalidatePath(`/${slug}/admin/projects`);
  redirect(`/${slug}/admin/projects`);
}
