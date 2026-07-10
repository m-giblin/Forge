"use server";

import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- service-role for issue creation
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { grokComplete } from "@/lib/services/grokAi";

interface SubIssueDraft {
  title: string;
  description: string;
  type: "task" | "feature" | "bug";
  priority: "low" | "medium" | "high" | "urgent";
}

export async function decomposeIssueAction(
  slug: string,
  issueId: string,
): Promise<{ subIssues: SubIssueDraft[]; error?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot use this feature.");

  const supabase = await createSupabaseServerClient();
  const { data: issue } = await supabase
    .from("issues")
    .select("title, description, type, priority, tenant_id")
    .eq("id", issueId)
    .eq("tenant_id", ctx.tenant.id)
    .single();

  if (!issue) throw new Error("Issue not found.");

  const prompt = `You are a senior engineering lead. Break down the following issue into 3-6 concrete, actionable sub-tasks.

Issue: "${(issue.title as string).slice(0, 200)}"
${issue.description ? `Description:\n${(issue.description as string).slice(0, 1000)}` : ""}

Return a JSON array of sub-task objects. Each object must have:
- title: string (short, action-oriented, max 80 chars)
- description: string (1-3 sentences explaining what to do)
- type: "task" | "feature" | "bug"
- priority: "low" | "medium" | "high" | "urgent"

Return ONLY the JSON array, no prose.`;

  try {
    const raw = await grokComplete(ctx.tenant.id, prompt, { temperature: 0.4, maxTokens: 1200, feature: "issue_decompose" });
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed: unknown = JSON.parse(clean || "[]");
    if (!Array.isArray(parsed)) {
      return { subIssues: [], error: "AI returned an unexpected format. Try again." };
    }
    return { subIssues: parsed as SubIssueDraft[] };
  } catch (e) {
    if (e instanceof Error && e.message.includes("No AI key configured")) {
      return {
        subIssues: [
          { title: "Sub-task 1", description: "First breakdown task.", type: "task", priority: "medium" },
          { title: "Sub-task 2", description: "Second breakdown task.", type: "task", priority: "medium" },
          { title: "Sub-task 3", description: "Third breakdown task.", type: "task", priority: "low" },
        ],
      };
    }
    return { subIssues: [], error: "AI decomposition failed. Try again." };
  }
}

export async function createSubIssuesAction(
  slug: string,
  parentIssueId: string,
  projectId: string,
  subIssues: SubIssueDraft[],
): Promise<{ count: number }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot create issues.");

  const svc = createSupabaseServiceClient();

  // Insert sub-issues one at a time, using the atomic next_issue_number() RPC
  // to avoid TOCTOU races on concurrent decompose calls for the same project.
  for (const s of subIssues) {
    const { data: numData } = await svc.rpc("next_issue_number", {
      p_tenant_id: ctx.tenant.id,
      p_project_id: projectId,
    });
    const number = (numData as number | null) ?? 1;
    await svc.from("issues").insert({
      tenant_id: ctx.tenant.id,
      project_id: projectId,
      parent_id: parentIssueId,
      number,
      title: s.title.slice(0, 500),
      description: s.description,
      type: s.type,
      priority: s.priority,
      status: "todo",
      reporter_id: ctx.appUserId,
    });
  }
  return { count: subIssues.length };
}
