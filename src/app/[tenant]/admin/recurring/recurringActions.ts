"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: recurring_issues writes bypass user RLS (admin-only; gate enforced in code)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type RecurringIssue = {
  id: string;
  project_id: string;
  title: string;
  type: string;
  priority: string;
  description: string | null;
  trigger: string;
  interval_sprints: number;
  is_active: boolean;
};

export type RecurringProject = { id: string; key: string; name: string };

function requireAdmin(role: string) {
  if (role !== "owner" && role !== "admin") {
    throw new Error("Only owners and admins can manage recurring issues.");
  }
}

/** Members can read; returns the tenant's recurring templates + projects for the picker. */
export async function listRecurringAction(
  slug: string
): Promise<{ items: RecurringIssue[]; projects: RecurringProject[] }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");

  const svc = createSupabaseServiceClient();
  const [itemsRes, projectsRes] = await Promise.all([
    svc
      .from("recurring_issues")
      .select("id, project_id, title, type, priority, description, trigger, interval_sprints, is_active")
      .eq("tenant_id", ctx.tenant.id)
      .order("created_at"),
    svc
      .from("projects")
      .select("id, key, name")
      .eq("tenant_id", ctx.tenant.id)
      .not("status", "eq", "archived")
      .order("key"),
  ]);

  return {
    items: (itemsRes.data as RecurringIssue[] | null) ?? [],
    projects: (projectsRes.data as RecurringProject[] | null) ?? [],
  };
}

export async function createRecurringAction(
  slug: string,
  data: {
    project_id: string;
    title: string;
    type: string;
    priority: string;
    description: string | null;
    trigger: string;
    interval_sprints: number;
  }
) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  requireAdmin(ctx.role);
  if (!data.project_id || !data.title.trim()) throw new Error("Project and title are required.");

  const svc = createSupabaseServiceClient();

  // Confirm the project belongs to this tenant before inserting.
  const { data: project } = await svc
    .from("projects")
    .select("id")
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", data.project_id)
    .maybeSingle();
  if (!project) throw new Error("Project not found.");

  const { error } = await svc.from("recurring_issues").insert({
    tenant_id: ctx.tenant.id,
    project_id: data.project_id,
    title: data.title.trim(),
    type: data.type,
    priority: data.priority,
    description: data.description?.trim() || null,
    trigger: data.trigger,
    interval_sprints: data.trigger === "every_n_sprints" ? data.interval_sprints : 1,
  });
  if (error) throw error;
  revalidatePath(`/${slug}/admin/recurring`);
}

export async function updateRecurringAction(
  slug: string,
  id: string,
  data: {
    project_id?: string;
    title?: string;
    type?: string;
    priority?: string;
    description?: string | null;
    trigger?: string;
    interval_sprints?: number;
    is_active?: boolean;
  }
) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  requireAdmin(ctx.role);

  const patch: Record<string, unknown> = {};
  if (data.project_id !== undefined) patch.project_id = data.project_id;
  if (data.title !== undefined) patch.title = data.title.trim();
  if (data.type !== undefined) patch.type = data.type;
  if (data.priority !== undefined) patch.priority = data.priority;
  if (data.description !== undefined) patch.description = data.description?.trim() || null;
  if (data.trigger !== undefined) patch.trigger = data.trigger;
  if (data.interval_sprints !== undefined) patch.interval_sprints = data.interval_sprints;
  if (data.is_active !== undefined) patch.is_active = data.is_active;
  patch.updated_at = new Date().toISOString();

  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("recurring_issues")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.id);
  if (error) throw error;
  revalidatePath(`/${slug}/admin/recurring`);
}

export async function deleteRecurringAction(slug: string, id: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  requireAdmin(ctx.role);

  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("recurring_issues")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.id);
  if (error) throw error;
  revalidatePath(`/${slug}/admin/recurring`);
}
