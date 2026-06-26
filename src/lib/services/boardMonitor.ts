/**
 * Board Monitor — proactive AI risk surfacing.
 * Called by the cron endpoint; result stored in platform_config as `board_health_digest`.
 * Shown automatically on Mission Control without any user action.
 */
import "server-only";
// eslint-disable-next-line no-restricted-imports -- service-role: cron runs outside user JWT
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { serverEnv } from "@/lib/env";

export type AlertLevel = "critical" | "warning" | "info";

export interface BoardAlert {
  level: AlertLevel;
  category:
    | "unowned_p1"
    | "stale_blocker"
    | "assignee_overload"
    | "stale_issue"
    | "sprint_risk"
    | "velocity"
    | "general";
  title: string;
  body: string;
  issue_keys?: string[];
  project_key?: string;
}

export interface BoardHealthDigest {
  scanned_at: string;
  alerts: BoardAlert[];
  ai_digest: string | null;
  total_open: number;
  critical_count: number;
  warning_count: number;
}

// ─── Rule-based checks ────────────────────────────────────────────────────────

interface IssueRow {
  id: string;
  key: string;
  title: string;
  priority: string | null;
  status: string;
  assignee_id: string | null;
  project_key: string | null;
  created_at: string;
  updated_at: string;
}

function hoursAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 1000 / 3600;
}

function runRules(issues: IssueRow[]): BoardAlert[] {
  const alerts: BoardAlert[] = [];

  // 1. Unowned P1s open > 12h
  const unownedP1 = issues.filter(
    (i) => (i.priority === "critical" || i.priority === "high") && !i.assignee_id && hoursAgo(i.created_at) > 12
  );
  if (unownedP1.length > 0) {
    alerts.push({
      level: "critical",
      category: "unowned_p1",
      title: `${unownedP1.length} high-priority issue${unownedP1.length > 1 ? "s" : ""} without an owner`,
      body: unownedP1.map((i) => i.key).join(", "),
      issue_keys: unownedP1.map((i) => i.key),
    });
  }

  // 2. Blocked issues aging > 48h with no status change
  const staleBlockers = issues.filter(
    (i) => i.status === "blocked" && hoursAgo(i.updated_at) > 48
  );
  if (staleBlockers.length > 0) {
    alerts.push({
      level: "critical",
      category: "stale_blocker",
      title: `${staleBlockers.length} blocked issue${staleBlockers.length > 1 ? "s" : ""} with no update in 48+ hours`,
      body: staleBlockers.map((i) => i.key).join(", "),
      issue_keys: staleBlockers.map((i) => i.key),
    });
  }

  // 3. Assignee overload: >8 open issues
  const byAssignee: Record<string, string[]> = {};
  for (const i of issues) {
    if (!i.assignee_id) continue;
    byAssignee[i.assignee_id] ??= [];
    byAssignee[i.assignee_id].push(i.key);
  }
  for (const [, keys] of Object.entries(byAssignee)) {
    if (keys.length > 8) {
      alerts.push({
        level: "warning",
        category: "assignee_overload",
        title: `A team member has ${keys.length} open issues assigned`,
        body: `Possible queue overload: ${keys.slice(0, 5).join(", ")}${keys.length > 5 ? ` +${keys.length - 5} more` : ""}`,
        issue_keys: keys,
      });
    }
  }

  // 4. Issues not touched in 7+ days
  const stale = issues.filter(
    (i) => i.status !== "done" && i.status !== "closed" && hoursAgo(i.updated_at) > 7 * 24
  );
  if (stale.length >= 5) {
    alerts.push({
      level: "warning",
      category: "stale_issue",
      title: `${stale.length} issues haven't been updated in 7+ days`,
      body: stale
        .slice(0, 6)
        .map((i) => i.key)
        .join(", ") + (stale.length > 6 ? ` and ${stale.length - 6} more` : ""),
      issue_keys: stale.map((i) => i.key),
    });
  }

  // 5. Large unassigned backlog
  const unassignedTotal = issues.filter((i) => !i.assignee_id).length;
  if (unassignedTotal > 10) {
    alerts.push({
      level: "info",
      category: "velocity",
      title: `${unassignedTotal} open issues are unassigned`,
      body: "Consider triaging and assigning ownership during next standup.",
    });
  }

  return alerts;
}

// ─── Grok AI narrative ────────────────────────────────────────────────────────

async function callGrokDigest(
  issues: IssueRow[],
  alerts: BoardAlert[]
): Promise<string | null> {
  const env = serverEnv();
  if (!env.GROK_API_KEY) return null;

  const summary = {
    total_open: issues.length,
    by_status: Object.entries(
      issues.reduce<Record<string, number>>((acc, i) => {
        acc[i.status] = (acc[i.status] ?? 0) + 1;
        return acc;
      }, {})
    ),
    by_priority: Object.entries(
      issues.reduce<Record<string, number>>((acc, i) => {
        const p = i.priority ?? "none";
        acc[p] = (acc[p] ?? 0) + 1;
        return acc;
      }, {})
    ),
    unassigned: issues.filter((i) => !i.assignee_id).length,
    rule_alerts: alerts.map((a) => `[${a.level.toUpperCase()}] ${a.title}`),
  };

  const systemMsg = `You are an AI engineering manager assistant. Your job is to give a sharp, concise daily board health assessment to the team lead. Be direct and specific. Avoid fluff. Use bullet points. Max 120 words.`;
  const userMsg = `--- BOARD SNAPSHOT ---\n${JSON.stringify(summary, null, 2)}\n--- END ---\n\nWrite a brief health assessment covering: (1) overall status in one sentence, (2) the top 1-2 risks to address today, (3) one positive if there is one. Keep it under 120 words.`;

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-3-mini",
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
        temperature: 0.4,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runBoardMonitor(tenantId: string): Promise<BoardHealthDigest> {
  const svc = createSupabaseServiceClient();

  // Fetch all non-done issues
  const { data: rawIssues } = await svc
    .from("issues")
    .select("id, key, title, priority, status, assignee_id, created_at, updated_at, project_id")
    .eq("tenant_id", tenantId)
    .not("status", "in", '("done","closed")')
    .order("created_at");

  // Fetch project key map
  const { data: projects } = await svc
    .from("projects")
    .select("id, key")
    .eq("tenant_id", tenantId);

  const projectKeyMap = new Map((projects ?? []).map((p) => [p.id as string, p.key as string]));

  const issues: IssueRow[] = (rawIssues ?? []).map((i) => ({
    id: i.id as string,
    key: i.key as string,
    title: i.title as string,
    priority: i.priority as string | null,
    status: i.status as string,
    assignee_id: i.assignee_id as string | null,
    project_key: projectKeyMap.get(i.project_id as string) ?? null,
    created_at: i.created_at as string,
    updated_at: i.updated_at as string,
  }));

  const alerts = runRules(issues);
  const ai_digest = await callGrokDigest(issues, alerts);

  const digest: BoardHealthDigest = {
    scanned_at: new Date().toISOString(),
    alerts,
    ai_digest,
    total_open: issues.length,
    critical_count: alerts.filter((a) => a.level === "critical").length,
    warning_count: alerts.filter((a) => a.level === "warning").length,
  };

  // Persist to platform_config
  await svc.from("platform_config").upsert(
    { tenant_id: tenantId, key: "board_health_digest", value: JSON.stringify(digest) },
    { onConflict: "tenant_id,key" }
  );

  return digest;
}

export async function getLatestBoardHealth(tenantId: string): Promise<BoardHealthDigest | null> {
  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("platform_config")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", "board_health_digest")
    .maybeSingle();

  if (!data?.value) return null;
  try {
    return JSON.parse(data.value as string) as BoardHealthDigest;
  } catch {
    return null;
  }
}
