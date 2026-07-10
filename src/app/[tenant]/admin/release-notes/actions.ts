"use server";

import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role for cross-tenant issue fetch
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { grokComplete } from "@/lib/services/grokAi";

export interface ReleaseIssue {
  key: string;
  title: string;
  type: string;
  priority: string;
  projectName: string;
}

export interface ReleaseNotes {
  version: string;
  summary: string;
  features: string[];
  fixes: string[];
  improvements: string[];
  breaking: string[];
  rawIssues: ReleaseIssue[];
}

export async function generateReleaseNotesAction(
  slug: string,
  fromDate: string,
  toDate: string,
  projectIds: string[]
): Promise<ReleaseNotes> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized");
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Admin only");

  const svc = createSupabaseServiceClient();

  // Fetch done issues in date range
  let q = svc
    .from("issues")
    .select("id, number, title, type, priority, updated_at, project_id, projects(key, name)")
    .eq("tenant_id", ctx.tenant.id)
    .eq("status", "done")
    .gte("updated_at", fromDate)
    .lte("updated_at", toDate + "T23:59:59Z")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (projectIds.length > 0) {
    q = q.in("project_id", projectIds);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const issues = (data ?? []) as unknown as Array<{
    id: string;
    number: number;
    title: string;
    type: string;
    priority: string;
    updated_at: string;
    project_id: string;
    projects: { key: string; name: string } | null;
  }>;

  if (issues.length === 0) {
    return {
      version: "v1.0",
      summary: "No issues were completed in this date range.",
      features: [],
      fixes: [],
      improvements: [],
      breaking: [],
      rawIssues: [],
    };
  }

  const rawIssues: ReleaseIssue[] = issues.map((i) => ({
    key: `${i.projects?.key ?? "?"}-${i.number}`,
    title: i.title,
    type: i.type,
    priority: i.priority,
    projectName: i.projects?.name ?? "Unknown",
  }));

  const noAiFallback = (): ReleaseNotes => ({
    version: "v1.0",
    summary: `${issues.length} issues completed between ${fromDate} and ${toDate}.`,
    features: rawIssues.filter((i) => i.type === "feature").map((i) => `${i.key}: ${i.title}`),
    fixes: rawIssues.filter((i) => i.type === "bug").map((i) => `${i.key}: ${i.title}`),
    improvements: rawIssues.filter((i) => i.type === "task").map((i) => `${i.key}: ${i.title}`),
    breaking: [],
    rawIssues,
  });

  const issueList = rawIssues
    .map((i) => `- [${i.key}] (${i.type}, ${i.priority}) ${i.title}`)
    .join("\n");

  const system = `You are a technical writer generating professional release notes for a software product.
Given a list of completed issues, produce structured release notes in JSON.
Categorize each item into features (new functionality), fixes (bug fixes), improvements (enhancements/refactors), or breaking (breaking changes).
Write each entry as a clear, customer-facing one-liner (not a raw ticket title).
Keep the summary to 2-3 sentences max.`;

  const user = `Generate release notes for issues completed ${fromDate} to ${toDate}:

${issueList}

Respond ONLY with valid JSON in this exact format:
{
  "version": "v1.0",
  "summary": "<2-3 sentence executive summary of what shipped>",
  "features": ["<customer-facing feature description>", ...],
  "fixes": ["<bug fix description>", ...],
  "improvements": ["<improvement description>", ...],
  "breaking": ["<breaking change if any>", ...]
}`;

  let text: string;
  try {
    text = await grokComplete(ctx.tenant.id,
      [{ role: "system", content: system }, { role: "user", content: user }],
      { temperature: 0.3, maxTokens: 1500, feature: "release_notes" },
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes("No AI key configured")) return noAiFallback();
    throw e;
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI returned unexpected format");

  const parsed = JSON.parse(jsonMatch[0]) as Omit<ReleaseNotes, "rawIssues">;
  return { ...parsed, rawIssues };
}

export async function getProjectsAction(slug: string): Promise<Array<{ id: string; key: string; name: string }>> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized");
  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("projects")
    .select("id, key, name")
    .eq("tenant_id", ctx.tenant.id)
    .order("name");
  return (data ?? []) as Array<{ id: string; key: string; name: string }>;
}
