import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { loadTenantFlags } from "@/lib/services/featureFlags";
import { serverEnv } from "@/lib/env";

type ChatMessage = { role: "system" | "user"; content: string };

async function callGrok(messages: ChatMessage[], apiKey: string): Promise<string> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "grok-3-mini", messages, temperature: 0.4, max_tokens: 1500 }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Grok API error ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error("Grok returned an empty response.");
  return text;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; sprintId: string }> }
) {
  const { slug, sprintId } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createSupabaseServiceClient();

  const flags = await loadTenantFlags(ctx.tenant.id);
  if (!flags.ai_sprint) {
    return NextResponse.json({ error: "AI Sprint Intelligence requires Premium or higher." }, { status: 403 });
  }

  // Fetch sprint
  const { data: sprint } = await svc
    .from("sprints")
    .select("id, name, goal, status, start_date, end_date")
    .eq("id", sprintId)
    .eq("tenant_id", ctx.tenant.id)
    .single();

  if (!sprint) return NextResponse.json({ error: "Sprint not found." }, { status: 404 });

  // Fetch issues in this sprint
  const { data: issues } = await svc
    .from("issues")
    .select("id, title, status, priority, story_points, assignee_id, created_at, updated_at, due_date")
    .eq("sprint_id", sprintId)
    .eq("tenant_id", ctx.tenant.id);

  const allIssues = issues ?? [];

  // Hard gate — refuse to run AI on empty or trivially short sprints
  if (allIssues.length === 0) {
    return NextResponse.json(
      { error: "No issues are attached to this sprint. Add work items before running analysis." },
      { status: 422 }
    );
  }
  if (sprint.start_date && sprint.end_date) {
    const days = Math.ceil(
      (new Date(sprint.end_date as string).getTime() - new Date(sprint.start_date as string).getTime()) / 86_400_000
    );
    if (days < 3) {
      return NextResponse.json(
        { error: `Sprint is only ${days} day(s) long — too short for meaningful analysis. Extend the end date to at least 3 days.` },
        { status: 422 }
      );
    }
  }

  // Fetch member names for assignees
  const assigneeIds = [...new Set(allIssues.map((i) => i.assignee_id).filter(Boolean))] as string[];
  const memberNames: Record<string, string> = {};
  if (assigneeIds.length > 0) {
    const { data: members } = await svc
      .from("users")
      .select("id, full_name")
      .in("id", assigneeIds);
    for (const m of members ?? []) {
      memberNames[m.id] = (m.full_name as string | null) ?? "Unknown";
    }
  }

  // Compute metrics
  const total = allIssues.length;
  const done = allIssues.filter((i) => i.status === "done").length;
  const slipped = total - done;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  const totalPoints = allIssues.reduce((s, i) => s + ((i.story_points as number | null) ?? 0), 0);
  const donePoints = allIssues
    .filter((i) => i.status === "done")
    .reduce((s, i) => s + ((i.story_points as number | null) ?? 0), 0);

  // Cycle time for completed issues (updated_at - created_at in days)
  const cycleTimes = allIssues
    .filter((i) => i.status === "done" && i.created_at && i.updated_at)
    .map((i) => {
      const created = new Date(i.created_at as string).getTime();
      const updated = new Date(i.updated_at as string).getTime();
      return Math.round((updated - created) / 86_400_000);
    });
  const avgCycleTime = cycleTimes.length > 0
    ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length)
    : null;

  // Assignee load
  const loadMap: Record<string, { assigned: number; done: number }> = {};
  for (const issue of allIssues) {
    const name = issue.assignee_id ? (memberNames[issue.assignee_id as string] ?? "Unknown") : "Unassigned";
    if (!loadMap[name]) loadMap[name] = { assigned: 0, done: 0 };
    loadMap[name].assigned++;
    if (issue.status === "done") loadMap[name].done++;
  }

  // High priority unfinished
  const highPrioritySlipped = allIssues.filter(
    (i) => i.status !== "done" && ["critical", "high"].includes((i.priority as string ?? "").toLowerCase())
  ).map((i) => i.title as string);

  // Sprint duration
  let sprintDays: number | null = null;
  if (sprint.start_date && sprint.end_date) {
    sprintDays = Math.ceil(
      (new Date(sprint.end_date as string).getTime() - new Date(sprint.start_date as string).getTime()) / 86_400_000
    );
  }

  // Build prompt
  const metricsBlock = [
    `Sprint: "${sprint.name}"${sprint.goal ? ` — Goal: "${sprint.goal}"` : ""}`,
    `Status: ${sprint.status}`,
    sprintDays ? `Duration: ${sprintDays} days` : null,
    `Issues: ${done}/${total} completed (${completionRate}%)`,
    totalPoints > 0 ? `Story points: ${donePoints}/${totalPoints} delivered` : null,
    avgCycleTime !== null ? `Average cycle time for completed issues: ${avgCycleTime} days` : null,
    slipped > 0 ? `Issues not completed: ${slipped}` : "All issues completed ✓",
    highPrioritySlipped.length > 0
      ? `High/critical priority issues that slipped:\n${highPrioritySlipped.map((t) => `  - ${t}`).join("\n")}`
      : null,
    `\nAssignee breakdown:`,
    ...Object.entries(loadMap).map(
      ([name, { assigned, done: d }]) => `  ${name}: ${d}/${assigned} completed`
    ),
  ].filter(Boolean).join("\n");

  const systemPrompt = `You are an engineering team performance advisor. You analyze sprint data and provide sharp, specific, actionable insights. Be direct. Avoid generic advice. Focus on patterns and root causes visible in the data. Keep your response concise — under 400 words.`;

  const userPrompt = `Analyze this sprint and return a structured report in the following JSON format. Do not include anything outside the JSON.

{
  "headline": "One sentence summarising the sprint outcome",
  "scoreLabel": "One of: Excellent / Good / Needs Attention / Off Track",
  "score": <integer 1-100>,
  "wins": ["up to 3 specific wins from the data"],
  "risks": ["up to 3 specific risks or patterns to watch"],
  "recommendation": "One specific, actionable thing the team should do differently next sprint"
}

Sprint data:
${metricsBlock}`;

  const env = serverEnv();
  if (!env.GROK_API_KEY) {
    return NextResponse.json({ error: "AI is not configured on this platform." }, { status: 503 });
  }

  let raw: string;
  try {
    raw = await callGrok(
      [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      env.GROK_API_KEY
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI call failed." }, { status: 502 });
  }

  // Parse JSON out of the response
  let report: unknown;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    report = match ? JSON.parse(match[0]) : JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "AI returned an unparseable response.", raw }, { status: 502 });
  }

  return NextResponse.json({ report, metrics: { total, done, completionRate, avgCycleTime, donePoints, totalPoints } });
}
