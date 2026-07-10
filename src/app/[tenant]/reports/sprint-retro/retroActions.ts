"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: AI summary write (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { grokComplete } from "@/lib/services/grokAi";

export async function generateRetroSummaryAction(slug: string, sprintId: string): Promise<string> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot generate a retro summary.");

  const svc = createSupabaseServiceClient();

  // Load sprint + project
  const { data: sprint } = await svc
    .from("sprints")
    .select("id, name, goal, status, start_date, end_date, project_id")
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", sprintId)
    .maybeSingle();
  if (!sprint) throw new Error("Sprint not found");

  const { data: project } = await svc
    .from("projects")
    .select("key, name")
    .eq("id", sprint.project_id)
    .maybeSingle();

  // Load issues + time logs
  const { data: issues } = await svc
    .from("issues")
    .select("id, number, title, status, priority, assignee_id, time_estimate_minutes, users!left(name)")
    .eq("tenant_id", ctx.tenant.id)
    .eq("sprint_id", sprintId);

  const issueIds = (issues ?? []).map((i) => i.id as string);
  const { data: timeLogs } = issueIds.length
    ? await svc.from("issue_time_logs").select("issue_id, minutes").in("issue_id", issueIds)
    : { data: [] };

  const logMap = new Map<string, number>();
  for (const t of timeLogs ?? []) {
    logMap.set(t.issue_id as string, (logMap.get(t.issue_id as string) ?? 0) + (t.minutes as number));
  }

  const done = (issues ?? []).filter((i) => i.status === "done" || i.status === "closed");
  const incomplete = (issues ?? []).filter((i) => i.status !== "done" && i.status !== "closed");
  const totalIssues = (issues ?? []).length;
  const velocity = `${done.length}/${totalIssues} issues completed`;

  const totalEstMin = (issues ?? []).reduce((s, i) => s + ((i.time_estimate_minutes as number) ?? 0), 0);
  const totalLogMin = [...logMap.values()].reduce((s, m) => s + m, 0);
  const variance = totalLogMin - totalEstMin;
  const varStr = variance === 0 ? "exactly on estimate"
    : variance > 0 ? `${Math.round(variance / 60)}h over estimate`
    : `${Math.round(-variance / 60)}h under estimate`;

  const issueList = (issues ?? []).map((i) => {
    const assignee = (i.users as { name?: string } | null)?.name ?? "Unassigned";
    const statusLabel = (i.status as string) === "done" ? "✓ Done" : `⏳ ${i.status}`;
    return `- [${project?.key ?? "?"}-${i.number}] ${i.title} (${assignee}, ${statusLabel})`;
  }).join("\n");

  const prompt = `You are a senior engineering manager writing a concise sprint retrospective summary. Be direct, honest, and actionable — no filler words.

Sprint: ${sprint.name}
Project: ${project?.name ?? "Unknown"} (${project?.key ?? "?"})
Goal: ${sprint.goal ?? "Not specified"}
Dates: ${sprint.start_date ?? "?"} to ${sprint.end_date ?? "?"}
Velocity: ${velocity}
Time variance: ${varStr} (${Math.round(totalLogMin / 60)}h logged vs ${Math.round(totalEstMin / 60)}h estimated)

Issues:
${issueList}

Write a retrospective summary in 3 sections:
1. **What we shipped** (2-3 sentences on what was accomplished)
2. **What slipped and why** (list the incomplete items — ${incomplete.length} total — and infer likely reasons from the data)
3. **Focus for next sprint** (3 concrete action items based on the data)

Keep it under 300 words. No emojis. No fluff.`;

  const summary = await grokComplete(ctx.tenant.id, prompt, { temperature: 0.3, maxTokens: 600, feature: "sprint_retro" });

  // Store on the sprint row
  await svc
    .from("sprints")
    .update({ retro_ai_summary: summary, retro_generated_at: new Date().toISOString() })
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", sprintId);

  revalidatePath(`/${slug}/reports/sprint-retro`);
  return summary;
}
