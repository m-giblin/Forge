"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { createIssue, moveIssue } from "@/lib/services/issues";
import type { IssuePriority, IssueStatus, IssueType } from "@/lib/repositories/issues";
import { ctxCanDo } from "@/lib/rbac";

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
  }
) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (!ctxCanDo(ctx, "create_issues"))
    throw new Error("You don't have permission to create issues in this workspace");

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
  });
  revalidatePath(`/${slug}/board`);
  return issue;
}

export async function moveIssueAction(slug: string, id: string, status: IssueStatus) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot move issues");

  await moveIssue(ctx.tenant.id, id, status);
  revalidatePath(`/${slug}/board`);
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
