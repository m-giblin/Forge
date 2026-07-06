"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { createIssue, moveIssue, COLUMN_PAGE_SIZE } from "@/lib/services/issues";
import type { Issue, IssuePriority, IssueStatus, IssueType } from "@/lib/repositories/issues";
import { ctxCanDo } from "@/lib/rbac";
import { canDo } from "@/lib/permissions";
// eslint-disable-next-line no-restricted-imports -- service-role required for child-count and load-more reads
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Every action re-checks tenant membership server-side. The client cannot be
// trusted; authorization lives here + RLS, never in the UI.

export async function createIssueAction(
  slug: string,
  input: {
    projectId: string;
    title: string;
    description?: string;
    priority?: IssuePriority;
    type?: IssueType;
    categoryId?: string | null;
    customValues?: Record<string, unknown>;
    sprintId?: string | null;
    assigneeId?: string | null;
  }
) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  // ctxCanDo: owners/admins always pass; members pass unless a custom role restricts them;
  // viewers are blocked by default. canDo then re-allows viewers when the tenant has
  // explicitly granted viewer.create_issue in their permission overrides.
  const viewerGranted = ctx.role === "viewer" && canDo(ctx.role, "viewer.create_issue", ctx.permissionOverrides);
  if (!viewerGranted && !ctxCanDo(ctx, "create_issues"))
    throw new Error("You don't have permission to create issues in this workspace");

  // Validate projectId belongs to this tenant — prevents cross-tenant project injection
  const svcForCheck = createSupabaseServiceClient();
  const { data: proj } = await svcForCheck.from("projects").select("id").eq("id", input.projectId).eq("tenant_id", ctx.tenant.id).maybeSingle();
  if (!proj) throw new Error("Project not found");

  const issue = await createIssue({
    tenantId: ctx.tenant.id,
    projectId: input.projectId,
    title: input.title,
    description: input.description,
    priority: input.priority,
    type: input.type,
    categoryId: input.categoryId,
    customValues: input.customValues,
    reporterId: ctx.appUserId,
    sprintId: input.sprintId,
    assigneeId: input.assigneeId,
  });
  revalidatePath(`/${slug}/board`);
  return issue;
}

export async function moveIssueAction(
  slug: string,
  id: string,
  status: IssueStatus,
): Promise<{ pendingChildCount: number }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot move issues");

  await moveIssue(ctx.tenant.id, id, status);
  revalidatePath(`/${slug}/board`);

  // Count children not yet on the new status so the board can prompt a cascade.
  const svc = createSupabaseServiceClient();
  const { count } = await svc
    .from("issues")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenant.id)
    .eq("parent_id", id)
    .neq("status", status);
  return { pendingChildCount: count ?? 0 };
}

export async function loadMoreForStatusAction(
  slug: string,
  projectId: string,
  status: string,
  offset: number,
): Promise<{ issues: Issue[]; hasMore: boolean }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");

  const svc = createSupabaseServiceClient();

  // Validate projectId belongs to this tenant before using it in the query
  const { data: proj } = await svc.from("projects").select("id").eq("id", projectId).eq("tenant_id", ctx.tenant.id).maybeSingle();
  if (!proj) throw new Error("Project not found");
  const { data } = await svc
    .from("issues")
    .select("*")
    .eq("tenant_id", ctx.tenant.id)
    .eq("project_id", projectId)
    .eq("status", status)
    .order("position", { ascending: true })
    .range(offset, offset + COLUMN_PAGE_SIZE - 1);

  const issues = (data ?? []) as Issue[];
  return { issues, hasMore: issues.length === COLUMN_PAGE_SIZE };
}

export interface IssueDraft {
  title: string;
  description: string;
  priority: IssuePriority;
  type: IssueType;
}

export async function draftIssueFromDescriptionAction(
  slug: string,
  rawDescription: string
): Promise<IssueDraft> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");

  const { serverEnv } = await import("@/lib/env");
  const env = serverEnv();
  if (!env.GROK_API_KEY) {
    // Fallback: use the raw description as the title
    return { title: rawDescription.slice(0, 100), description: rawDescription, priority: "medium", type: "bug" };
  }

  const system = `You are an issue tracker assistant. Given a raw description of a problem or task, extract structured issue fields. Respond ONLY with a JSON object, no prose.`;
  const user = `Description: "${rawDescription.slice(0, 1000)}"\n\nExtract: {"title": "<concise title under 80 chars>", "description": "<cleaned-up description with context>", "priority": "<low|medium|high|urgent>", "type": "<bug|feature|task|question>"}`;

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.GROK_API_KEY}` },
      body: JSON.stringify({
        model: "grok-3-mini",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.2,
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.ok) {
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = json.choices?.[0]?.message?.content ?? "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Partial<IssueDraft>;
        return {
          title: (parsed.title ?? rawDescription.slice(0, 80)).slice(0, 80),
          description: parsed.description ?? rawDescription,
          priority: (["low", "medium", "high", "urgent"].includes(parsed.priority ?? "") ? parsed.priority : "medium") as IssuePriority,
          type: (["bug", "feature", "task", "question"].includes(parsed.type ?? "") ? parsed.type : "bug") as IssueType,
        };
      }
    }
  } catch {
    // fall through to fallback
  }

  return { title: rawDescription.slice(0, 80), description: rawDescription, priority: "medium", type: "bug" };
}

export async function quickEditIssueAction(
  slug: string,
  id: string,
  patch: { priority?: IssuePriority; assigneeId?: string | null; title?: string }
) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot edit issues");

  const { updateIssue } = await import("@/lib/services/issues");
  await updateIssue(ctx.tenant.id, id, patch, { userId: ctx.appUserId, label: null });
  revalidatePath(`/${slug}/board`);
}
