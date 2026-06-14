"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { createProject } from "@/lib/services/projects";
import { recordAudit } from "@/lib/audit";

function assertAdmin(role: string) {
  if (role !== "owner" && role !== "admin") throw new Error("Only owners and admins can create projects.");
}

export async function createProjectAction(
  slug: string,
  input: {
    name: string;
    key?: string | null;
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
