"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: sprint writes bypass user-JWT RLS (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sprintsRepo, type Sprint } from "@/lib/repositories/sprints";

function assertCanEdit(role: string) {
  if (role === "viewer") throw new Error("Viewers cannot manage sprints.");
}

function svc() {
  return sprintsRepo(createSupabaseServiceClient());
}

export async function createSprintAction(
  slug: string,
  projectId: string,
  name: string,
  goal: string,
  startDate: string,
  endDate: string,
): Promise<Sprint> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEdit(ctx.role);
  const sprint = await svc().create({
    tenantId: ctx.tenant.id,
    projectId,
    name: name.trim() || "Sprint",
    goal: goal.trim() || null,
    startDate: startDate || null,
    endDate: endDate || null,
  });
  revalidatePath(`/${slug}/board`);
  return sprint;
}

export async function startSprintAction(slug: string, sprintId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEdit(ctx.role);
  await svc().update(ctx.tenant.id, sprintId, { status: "active" });
  revalidatePath(`/${slug}/board`);
}

export async function completeSprintAction(slug: string, sprintId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEdit(ctx.role);
  await svc().update(ctx.tenant.id, sprintId, { status: "completed" });
  revalidatePath(`/${slug}/board`);
}

export async function addIssueToSprintAction(slug: string, sprintId: string, issueId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEdit(ctx.role);
  await svc().addIssue(sprintId, ctx.tenant.id, issueId);
  revalidatePath(`/${slug}/board`);
}

export async function removeIssueFromSprintAction(slug: string, issueId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEdit(ctx.role);
  await svc().removeIssue(ctx.tenant.id, issueId);
  revalidatePath(`/${slug}/board`);
}
