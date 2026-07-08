"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { createProject } from "@/lib/services/projects";
import { updateIssue } from "@/lib/services/issues";
import { recordAudit } from "@/lib/audit";
// eslint-disable-next-line no-restricted-imports -- service-role: template seeding writes bypass user-JWT RLS
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getTemplate, type TemplateKey } from "@/lib/projectTemplates";

export async function quickAssignAction(slug: string, issueId: string, assigneeId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot assign issues.");
  await updateIssue(ctx.tenant.id, issueId, { assigneeId }, { userId: ctx.appUserId, label: ctx.email ?? null });
  revalidatePath(`/${slug}`);
}

function assertAdmin(role: string) {
  if (role !== "owner" && role !== "admin") throw new Error("Only owners and admins can create projects.");
}

export async function createProjectAction(
  slug: string,
  input: {
    name: string;
    key?: string | null;
    description?: string | null;
    status?: string | null;
    ownerUserId?: string | null;
    startDate?: string | null;
    targetGoLive?: string | null;
  }
): Promise<{ key: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertAdmin(ctx.role);

  const project = await createProject({
    tenantId: ctx.tenant.id,
    name: input.name,
    key: input.key ?? null,
    description: input.description ?? null,
    status: input.status ?? null,
    ownerUserId: input.ownerUserId ?? null,
    startDate: input.startDate ?? null,
    targetGoLive: input.targetGoLive ?? null,
  });

  await recordAudit({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.appUserId,
    action: "project.create",
    target: project.key,
    metadata: { name: project.name, owner: input.ownerUserId ?? null, target_go_live: input.targetGoLive ?? null },
  });

  revalidatePath(`/${slug}`);
  revalidatePath(`/${slug}/admin/projects`);
  return { key: project.key };
}

export async function applyProjectTemplateAction(
  slug: string,
  projectKey: string,
  templateKey: TemplateKey,
): Promise<void> {
  if (templateKey === "blank") return;

  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertAdmin(ctx.role);

  const svc = createSupabaseServiceClient();
  const template = getTemplate(templateKey);

  const { data: project } = await svc
    .from("projects")
    .select("id")
    .eq("tenant_id", ctx.tenant.id)
    .eq("key", projectKey)
    .maybeSingle();
  if (!project) throw new Error("Project not found");

  // Seed categories
  if (template.categories.length) {
    await svc.from("issue_categories").insert(
      template.categories.map((c) => ({
        tenant_id: ctx.tenant.id,
        project_id: project.id,
        name: c.name,
        color: c.color,
      })),
    );
  }

  // Seed issues (number them starting from 1 within project)
  if (template.issues.length) {
    const { data: maxRow } = await svc
      .from("issues")
      .select("number")
      .eq("tenant_id", ctx.tenant.id)
      .eq("project_id", project.id)
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();
    let nextNum = (maxRow?.number ?? 0) + 1;

    for (const iss of template.issues) {
      await svc.from("issues").insert({
        tenant_id: ctx.tenant.id,
        project_id: project.id,
        title: iss.title,
        type: iss.type,
        priority: iss.priority,
        status: iss.status,
        number: nextNum++,
        source: "template",
      });
    }
  }

  // Seed a sprint if template has one
  if (template.sprintName) {
    await svc.from("sprints").insert({
      tenant_id: ctx.tenant.id,
      project_id: project.id,
      name: template.sprintName,
      goal: template.sprintGoal ?? null,
      status: "planning",
    });
  }

  revalidatePath(`/${slug}`);
  revalidatePath(`/${slug}/admin/projects`);
}
