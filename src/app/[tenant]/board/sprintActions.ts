"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports -- service-role: sprint writes bypass user-JWT RLS (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sprintsRepo, type Sprint } from "@/lib/repositories/sprints";
import { notifyChatSprintEvent } from "@/lib/services/chatNotifications";
import { notificationsRepo } from "@/lib/repositories/notifications";
import { grokComplete } from "@/lib/services/grokAi";

function assertCanEdit(ctx: Parameters<typeof ctxCanDo>[0]) {
  if (!ctxCanDo(ctx, "manage_sprints")) throw new Error("You don't have permission to manage sprints.");
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
  assertCanEdit(ctx);
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
  assertCanEdit(ctx);
  await svc().update(ctx.tenant.id, sprintId, { status: "active" });
  revalidatePath(`/${slug}/board`);

  void (async () => {
    try {
      const db = createSupabaseServiceClient();
      const { data: sprint } = await db
        .from("sprints")
        .select("name, goal, project_id")
        .eq("id", sprintId)
        .maybeSingle();
      if (!sprint) return;

      const { data: project } = await db
        .from("projects")
        .select("key")
        .eq("id", sprint.project_id)
        .maybeSingle();

      // Seed recurring issues for this sprint
      const { data: recurring } = await db
        .from("recurring_issues")
        .select("id, title, type, priority, description, trigger, interval_sprints, sprint_count")
        .eq("tenant_id", ctx.tenant.id)
        .eq("project_id", sprint.project_id)
        .eq("is_active", true);

      for (const ri of recurring ?? []) {
        const newCount = (ri.sprint_count as number) + 1;
        const shouldCreate =
          ri.trigger === "every_sprint" ||
          (ri.trigger === "every_n_sprints" && newCount >= (ri.interval_sprints as number));

        if (shouldCreate) {
          // Get next issue number for this project
          const { data: maxRow } = await db
            .from("issues")
            .select("number")
            .eq("tenant_id", ctx.tenant.id)
            .eq("project_id", sprint.project_id)
            .order("number", { ascending: false })
            .limit(1)
            .maybeSingle();
          const nextNum = ((maxRow?.number as number) ?? 0) + 1;

          await db.from("issues").insert({
            tenant_id: ctx.tenant.id,
            project_id: sprint.project_id,
            sprint_id: sprintId,
            title: ri.title,
            type: ri.type,
            priority: ri.priority,
            description: ri.description,
            status: "todo",
            number: nextNum,
            source: "recurring",
          });

          await db
            .from("recurring_issues")
            .update({ sprint_count: 0, updated_at: new Date().toISOString() })
            .eq("id", ri.id);
        } else {
          await db
            .from("recurring_issues")
            .update({ sprint_count: newCount, updated_at: new Date().toISOString() })
            .eq("id", ri.id);
        }
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";

      await notifyChatSprintEvent(ctx.tenant.id, {
        event: "sprint_started",
        sprintName: sprint.name,
        sprintGoal: sprint.goal,
        projectKey: project?.key ?? "?",
        boardUrl: `${baseUrl}/${slug}/board`,
        actorLabel: ctx.email ?? null,
      });

      // In-app: notify all project members
      const { data: members } = await db
        .from("memberships")
        .select("user_id")
        .eq("tenant_id", ctx.tenant.id);
      const body = `Sprint "${sprint.name}" has started${sprint.goal ? ` — ${sprint.goal}` : ""}.`;
      await Promise.allSettled(
        (members ?? [])
          .filter((m) => m.user_id !== ctx.appUserId)
          .map((m) =>
            notificationsRepo(db).create({
              tenantId: ctx.tenant.id,
              userId: m.user_id,
              type: "sprint_started",
              title: `Sprint started: ${sprint.name}`,
              body,
              linkPath: `/${slug}/board`,
            }),
          ),
      );
    } catch (e) {
      console.error("startSprintAction notification failed", e);
    }
  })();
}

export async function completeSprintAction(slug: string, sprintId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEdit(ctx);
  await svc().update(ctx.tenant.id, sprintId, { status: "completed" });
  revalidatePath(`/${slug}/board`);

  void (async () => {
    try {
      const db = createSupabaseServiceClient();
      const { data: sprint } = await db
        .from("sprints")
        .select("name, goal, project_id")
        .eq("id", sprintId)
        .maybeSingle();
      if (!sprint) return;

      const { data: project } = await db
        .from("projects")
        .select("key")
        .eq("id", sprint.project_id)
        .maybeSingle();

      // Count velocity
      const { data: issues } = await db
        .from("issues")
        .select("status")
        .eq("tenant_id", ctx.tenant.id)
        .eq("sprint_id", sprintId);
      const totalIssues = issues?.length ?? 0;
      const doneIssues = (issues ?? []).filter((i) => i.status === "done" || i.status === "closed").length;

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";

      await notifyChatSprintEvent(ctx.tenant.id, {
        event: "sprint_completed",
        sprintName: sprint.name,
        sprintGoal: sprint.goal,
        projectKey: project?.key ?? "?",
        boardUrl: `${baseUrl}/${slug}/board`,
        actorLabel: ctx.email ?? null,
        totalIssues,
        doneIssues,
      });

      // In-app: notify all project members
      const { data: members } = await db
        .from("memberships")
        .select("user_id")
        .eq("tenant_id", ctx.tenant.id);
      const body = `Sprint "${sprint.name}" completed — ${doneIssues}/${totalIssues} issues done.`;
      await Promise.allSettled(
        (members ?? [])
          .filter((m) => m.user_id !== ctx.appUserId)
          .map((m) =>
            notificationsRepo(db).create({
              tenantId: ctx.tenant.id,
              userId: m.user_id,
              type: "sprint_completed",
              title: `Sprint completed: ${sprint.name}`,
              body,
              linkPath: `/${slug}/board`,
            }),
          ),
      );
    } catch (e) {
      console.error("completeSprintAction notification failed", e);
    }
  })();
}

export async function addIssueToSprintAction(slug: string, sprintId: string, issueId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEdit(ctx);
  await svc().addIssue(sprintId, ctx.tenant.id, issueId);
  revalidatePath(`/${slug}/board`);
}

export async function removeIssueFromSprintAction(slug: string, issueId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEdit(ctx);
  await svc().removeIssue(ctx.tenant.id, issueId);
  revalidatePath(`/${slug}/board`);
}

/** Bulk-create evenly spaced sprints from a cadence. */
export async function updateSprintAction(
  slug: string,
  sprintId: string,
  patch: { name?: string; goal?: string; startDate?: string; endDate?: string }
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEdit(ctx);
  await svc().update(ctx.tenant.id, sprintId, {
    name:      patch.name?.trim()      || undefined,
    goal:      patch.goal?.trim()      ?? null,
    startDate: patch.startDate?.trim() || null,
    endDate:   patch.endDate?.trim()   || null,
  });
  revalidatePath(`/${slug}/board`);
}

export async function bulkCreateSprintsAction(
  slug: string,
  projectId: string,
  sprints: { name: string; goal: string; startDate: string; endDate: string }[]
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEdit(ctx);
  const repo = svc();
  for (const s of sprints) {
    await repo.create({
      tenantId: ctx.tenant.id,
      projectId,
      name: s.name.trim() || "Sprint",
      goal: s.goal.trim() || null,
      startDate: s.startDate || null,
      endDate: s.endDate || null,
    });
  }
  revalidatePath(`/${slug}/board`);
}

/** Parse a plain-text sprint plan with Grok and return structured sprints. */
export async function parseSprintDocAction(
  slug: string,
  text: string
): Promise<{ name: string; goal: string; startDate: string; endDate: string }[]> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEdit(ctx);

  const today = new Date().toISOString().slice(0, 10);
  const prompt = `You are a sprint planning assistant. Parse the following sprint plan document and return a JSON array of sprint objects.

Each object must have exactly these fields:
- "name": string (e.g. "Sprint 1", "Sprint 0 — Foundation")
- "goal": string (short description of sprint goal, or "" if not stated)
- "startDate": string in YYYY-MM-DD format (or "" if not specified)
- "endDate": string in YYYY-MM-DD format (or "" if not specified)

Today is ${today}. If dates are relative (e.g. "Week 1"), calculate from today.
Return ONLY valid JSON — no markdown, no explanation, no code fences.

Document:
---
${text.slice(0, 8000)}
---`;

  const raw = await grokComplete(ctx.tenant.id, prompt, { temperature: 0.1, maxTokens: 2000, feature: "sprint_plan_parser" });

  try {
    const parsed = JSON.parse(raw || "[]") as unknown;
    if (!Array.isArray(parsed)) throw new Error("AI did not return an array");
    return (parsed as Record<string, string>[]).map((s) => ({
      name:      String(s.name ?? "Sprint"),
      goal:      String(s.goal ?? ""),
      startDate: String(s.startDate ?? ""),
      endDate:   String(s.endDate ?? ""),
    }));
  } catch {
    throw new Error("AI returned unreadable output. Try again or simplify the document.");
  }
}
