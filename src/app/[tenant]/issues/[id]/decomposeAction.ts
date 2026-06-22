"use server";

import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- service-role for issue creation
import { createSupabaseServiceClient } from "@/lib/supabase/service";

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

  const grokKey = process.env.GROK_API_KEY;
  if (!grokKey) {
    return {
      subIssues: [
        { title: "Sub-task 1", description: "First breakdown task.", type: "task", priority: "medium" },
        { title: "Sub-task 2", description: "Second breakdown task.", type: "task", priority: "medium" },
        { title: "Sub-task 3", description: "Third breakdown task.", type: "task", priority: "low" },
      ],
    };
  }

  const prompt = `You are a senior engineering lead. Break down the following issue into 3-6 concrete, actionable sub-tasks.

Issue: "${issue.title}"
${issue.description ? `Description:\n${issue.description}` : ""}

Return a JSON array of sub-task objects. Each object must have:
- title: string (short, action-oriented, max 80 chars)
- description: string (1-3 sentences explaining what to do)
- type: "task" | "feature" | "bug"
- priority: "low" | "medium" | "high" | "urgent"

Return ONLY the JSON array, no prose.`;

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${grokKey}`,
      },
      body: JSON.stringify({
        model: "grok-3-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 1200,
      }),
    });
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "[]";
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean) as SubIssueDraft[];
    return { subIssues: parsed };
  } catch {
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

  // Get current max number for the project
  const { data: maxRow } = await svc
    .from("issues")
    .select("number")
    .eq("project_id", projectId)
    .eq("tenant_id", ctx.tenant.id)
    .order("number", { ascending: false })
    .limit(1)
    .single();

  let nextNumber = (maxRow?.number ?? 0) + 1;

  const rows = subIssues.map((s) => ({
    tenant_id: ctx.tenant.id,
    project_id: projectId,
    parent_id: parentIssueId,
    number: nextNumber++,
    title: s.title,
    description: s.description,
    type: s.type,
    priority: s.priority,
    status: "todo",
    reporter_id: ctx.appUserId,
  }));

  await svc.from("issues").insert(rows);
  return { count: rows.length };
}
