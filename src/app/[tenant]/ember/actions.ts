"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- service-role: cross-tenant-safe project lookup + issue create, matching board/actions.ts's pattern (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { projectsRepo } from "@/lib/repositories/projects";
import { createIssue } from "@/lib/services/issues";
import { ctxCanDo } from "@/lib/rbac";
import { canDo } from "@/lib/permissions";
import { askEmber, type EmberAnswer, type ProjectContext } from "@/lib/services/emberAssistant";
import type { Issue } from "@/lib/repositories/issues";

/** Pulls a project key out of "/projects/KEY/..." or "?project=KEY" — the two
 * places a project shows up in the URL today. Best-effort: if neither
 * matches, Ember just runs without project context (falls back to Q&A). */
function extractProjectKey(pathAndQuery: string): string | null {
  const pathMatch = pathAndQuery.match(/\/projects\/([^/?#]+)/);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);
  const queryMatch = pathAndQuery.match(/[?&]project=([^&#]+)/);
  if (queryMatch) return decodeURIComponent(queryMatch[1]);
  return null;
}

export async function askEmberAction(slug: string, question: string, pathAndQuery: string): Promise<EmberAnswer> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");

  const trimmed = question.trim();
  if (!trimmed) throw new Error("Ask Ember something first.");
  if (trimmed.length > 500) throw new Error("Keep questions under 500 characters.");

  const role = (ctx.role === "owner" || ctx.role === "admin" || ctx.role === "member" || ctx.role === "viewer"
    ? ctx.role
    : "viewer") as "owner" | "admin" | "member" | "viewer";

  let projectContext: ProjectContext | null = null;
  const key = extractProjectKey(pathAndQuery);
  if (key) {
    const project = await projectsRepo(createSupabaseServiceClient()).getByKey(ctx.tenant.id, key);
    if (project) projectContext = { id: project.id, key: project.key, name: project.name };
  }

  const supabase = await createSupabaseServerClient();
  return askEmber(supabase, ctx.tenant.id, ctx.appUserId, trimmed, role, projectContext);
}

/**
 * The ONLY thing that actually writes data in the Ember flow. Re-validates
 * everything from scratch server-side — the client only ever echoes back a
 * ProposedAction it received a moment ago, and that is never trusted as-is:
 * permission, project-tenant ownership, and role are all re-checked exactly
 * like board/actions.ts's createIssueAction does for a normal issue create.
 */
export async function confirmEmberCreateIssueAction(slug: string, projectId: string, title: string): Promise<Issue> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");

  const viewerGranted = ctx.role === "viewer" && canDo(ctx.role, "viewer.create_issue", ctx.permissionOverrides);
  if (!viewerGranted && !ctxCanDo(ctx, "create_issues"))
    throw new Error("You don't have permission to create issues in this workspace.");

  const svc = createSupabaseServiceClient();
  const { data: project } = await svc.from("projects").select("id, key").eq("id", projectId).eq("tenant_id", ctx.tenant.id).maybeSingle();
  if (!project) throw new Error("Project not found in this workspace.");

  const trimmedTitle = title.trim();
  if (!trimmedTitle) throw new Error("Issue needs a title.");

  const issue = await createIssue({
    tenantId: ctx.tenant.id,
    projectId,
    title: trimmedTitle,
    reporterId: ctx.appUserId,
  });

  revalidatePath(`/${slug}/board`);
  revalidatePath(`/${slug}/projects/${project.key}`);
  return issue;
}
