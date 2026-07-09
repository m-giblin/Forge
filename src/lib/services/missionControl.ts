import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { listVisibleProjects } from "@/lib/services/projects";
import type { MembershipRole } from "@/lib/repositories/members";
import { computeDoraMetrics, type DoraMetrics } from "@/lib/services/dora";

/**
 * Mission Control — the post-login tenant hub ("Design E").
 *
 * IMPORTANT — what is REAL vs PREVIEW:
 *  - Everything this service returns is computed from the issue database
 *    (issues + issue_events + projects). It is REAL data.
 *  - The dashboard ALSO renders an "Engineering Intelligence (Preview)" band
 *    (DORA four-keys, 4-phase commit→deploy cycle time, Monte Carlo forecast).
 *    Those require Git/CI/deploy data that Forge does not yet collect, so they
 *    are rendered with clearly-labelled sample data and a Preview badge. They
 *    are NOT produced here — this service only ever returns real numbers.
 */

export type ScopeKey = "mine" | "team";

export type AttentionTag = "ASSIGNED" | "IN_REVIEW" | "BLOCKED" | "STALE" | "UNASSIGNED";

export type AttentionItem = {
  issueId: string;
  tag: AttentionTag;
  title: string;
  ref: string; // e.g. "FORGE-204"
  meta: string;
  urgent: boolean;
};

export type PortfolioProject = {
  id: string;
  key: string;
  name: string;
  total: number;
  inProgress: number;
  inReview: number;
  done: number;
  open: number;
  pctDone: number;
  targetGoLive: string | null;
};

export type ThroughputWeek = { label: string; done: number };

export type MissionControlData = {
  greetingName: string;
  scope: ScopeKey;
  canSeeTeam: boolean;
  stats: { open: number; inProgress: number; doneThisWeek: number; unassigned: number };
  narrative: string;
  attention: AttentionItem[];
  portfolio: PortfolioProject[];
  throughput: ThroughputWeek[];
  avgCycleDays: number | null;
  /** % of done issues that are bugs (change failure proxy) */
  bugFailRate: number | null;
  /** Avg days from bug created → done (MTTR proxy) */
  avgBugCycleDays: number | null;
  /** Issues shipped per week over last 4 weeks */
  weeklyVelocity: number | null;
  /** Real DORA four-keys computed from deployments + code_events. Null fields = not enough data yet, not fabricated. */
  dora: DoraMetrics;
};

type LeanIssue = {
  id: string;
  project_id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  type: string;
  assignee_id: string | null;
  reporter_id: string | null;
  labels: string[] | null;
  created_at: string;
  updated_at: string;
};

type LeanEvent = {
  issue_id: string;
  field: string;
  new_value: string | null;
  created_at: string;
};

const DONE = "done";
const IN_REVIEW = "in_review";
const IN_PROGRESS = "in_progress";
const STALE_DAYS = 14;
const MS_DAY = 24 * 60 * 60 * 1000;

function isAdmin(role: MembershipRole) {
  return role === "owner" || role === "admin";
}

function daysAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / MS_DAY;
}

function hasBlockedLabel(labels: string[] | null): boolean {
  return (labels ?? []).some((l) => l.toLowerCase().includes("block"));
}

function isoWeekKey(d: Date): string {
  // Monday-anchored week label like "Jun 9". Good enough for a 6-week strip.
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(d.getTime() - day * MS_DAY);
  return monday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Load the Mission Control hub for a tenant + user. Reads through RLS on the
 * human path (which naturally scopes a member to what they can see); uses the
 * service-role client during super-admin impersonation, still tenant-scoped.
 */
export async function loadMissionControl(input: {
  tenantId: string;
  appUserId: string;
  role: MembershipRole;
  email: string | null;
  impersonating: boolean;
  scope: ScopeKey;
  projectKey?: string;
}): Promise<MissionControlData> {
  const supabase = input.impersonating
    ? createSupabaseServiceClient()
    : await createSupabaseServerClient();

  const canSeeTeam = isAdmin(input.role) || input.impersonating;
  const scope: ScopeKey = input.scope === "team" && canSeeTeam ? "team" : "mine";

  // Fetch the building blocks in parallel. Lean columns only (no body/stack).
  const [issuesRes, eventsRes, projects, nameRes, dora] = await Promise.all([
    supabase
      .from("issues")
      .select("id, project_id, number, title, status, priority, type, assignee_id, reporter_id, labels, created_at, updated_at")
      .eq("tenant_id", input.tenantId)
      .order("updated_at", { ascending: false })
      .limit(2000),
    supabase
      .from("issue_events")
      .select("issue_id, field, new_value, created_at")
      .eq("tenant_id", input.tenantId)
      .order("created_at", { ascending: false })
      .limit(1000),
    listVisibleProjects(input.tenantId, input.appUserId, input.role, input.impersonating),
    supabase.from("users").select("name").eq("id", input.appUserId).maybeSingle(),
    computeDoraMetrics(input.tenantId).catch(() => ({
      deploymentsPerWeek: null, changeFailureRatePct: null, mttrHours: null, leadTimeHours: null, totalDeployments: 0, windowDays: 30,
    })),
  ]);

  const allIssues = (issuesRes.data ?? []) as LeanIssue[];
  const events = (eventsRes.data ?? []) as LeanEvent[];

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const visibleProjectIds = new Set(projects.map((p) => p.id));

  // Team issues = those in projects this user can see. Mine = assigned to me.
  const allTeamIssues = allIssues.filter((i) => visibleProjectIds.has(i.project_id));
  // Optional project filter for team scope
  const filterProjectId = input.projectKey
    ? projects.find((p) => p.key === input.projectKey)?.id
    : undefined;
  const teamIssues = filterProjectId
    ? allTeamIssues.filter((i) => i.project_id === filterProjectId)
    : allTeamIssues;
  const mineIssues = allTeamIssues.filter((i) => i.assignee_id === input.appUserId);
  const scoped = scope === "team" ? teamIssues : mineIssues;

  const refFor = (i: LeanIssue) => {
    const p = projectById.get(i.project_id);
    return p ? `${p.key}-${i.number}` : `#${i.number}`;
  };

  // ---- Headline stats (real counts over the scoped set) ----
  const doneEventByIssue = new Map<string, string>(); // issueId -> latest done timestamp
  for (const e of events) {
    if (e.field === "status" && e.new_value === DONE && !doneEventByIssue.has(e.issue_id)) {
      doneEventByIssue.set(e.issue_id, e.created_at);
    }
  }

  const open = scoped.filter((i) => i.status !== DONE).length;
  const inProgress = scoped.filter((i) => i.status === IN_PROGRESS).length;
  const unassigned = teamIssues.filter((i) => !i.assignee_id && i.status !== DONE).length;

  const scopedIds = new Set(scoped.map((i) => i.id));
  let doneThisWeek = 0;
  for (const [issueId, ts] of doneEventByIssue) {
    if (scopedIds.has(issueId) && daysAgo(ts) <= 7) doneThisWeek++;
  }

  // ---- Attention queue (honest, reason-tagged) ----
  const attention: AttentionItem[] = [];
  if (scope === "mine") {
    for (const i of mineIssues) {
      if (i.status === DONE) continue;
      if (hasBlockedLabel(i.labels)) {
        attention.push({ issueId: i.id, tag: "BLOCKED", title: i.title, ref: refFor(i), meta: "Labelled blocked", urgent: true });
      } else if (i.status === IN_REVIEW) {
        attention.push({ issueId: i.id, tag: "IN_REVIEW", title: i.title, ref: refFor(i), meta: "Your issue is in review", urgent: false });
      } else if (daysAgo(i.updated_at) > STALE_DAYS) {
        attention.push({ issueId: i.id, tag: "STALE", title: i.title, ref: refFor(i), meta: `No update in ${Math.round(daysAgo(i.updated_at))} days`, urgent: false });
      } else {
        attention.push({ issueId: i.id, tag: "ASSIGNED", title: i.title, ref: refFor(i), meta: `${i.priority} priority · ${i.status.replace(/_/g, " ")}`, urgent: i.priority === "urgent" });
      }
    }
  } else {
    for (const i of teamIssues) {
      if (i.status === DONE) continue;
      if (hasBlockedLabel(i.labels)) {
        attention.push({ issueId: i.id, tag: "BLOCKED", title: i.title, ref: refFor(i), meta: "Labelled blocked", urgent: true });
      } else if (!i.assignee_id) {
        attention.push({ issueId: i.id, tag: "UNASSIGNED", title: i.title, ref: refFor(i), meta: `${i.priority} priority · needs an owner`, urgent: i.priority === "urgent" });
      } else if (i.status === IN_REVIEW) {
        attention.push({ issueId: i.id, tag: "IN_REVIEW", title: i.title, ref: refFor(i), meta: "Awaiting review", urgent: false });
      }
    }
  }
  // Urgent first, then by tag weight, cap at 8.
  const tagWeight: Record<AttentionTag, number> = { BLOCKED: 0, UNASSIGNED: 1, IN_REVIEW: 2, STALE: 3, ASSIGNED: 4 };
  attention.sort((a, b) => Number(b.urgent) - Number(a.urgent) || tagWeight[a.tag] - tagWeight[b.tag]);
  const attentionTop = attention.slice(0, 8);

  // ---- Portfolio (real per-status counts over visible projects) ----
  const portfolio: PortfolioProject[] = projects.map((p) => {
    const pi = teamIssues.filter((i) => i.project_id === p.id);
    const done = pi.filter((i) => i.status === DONE).length;
    const total = pi.length;
    return {
      id: p.id,
      key: p.key,
      name: p.name,
      total,
      inProgress: pi.filter((i) => i.status === IN_PROGRESS).length,
      inReview: pi.filter((i) => i.status === IN_REVIEW).length,
      done,
      open: total - done,
      pctDone: total ? Math.round((done / total) * 100) : 0,
      targetGoLive: p.target_go_live ?? null,
    };
  });
  portfolio.sort((a, b) => b.open - a.open);

  // ---- Throughput: issues moved to done per week, last 6 weeks (real) ----
  const weekBuckets: { key: string; label: string; start: number }[] = [];
  const now = new Date();
  for (let w = 5; w >= 0; w--) {
    const ref = new Date(now.getTime() - w * 7 * MS_DAY);
    weekBuckets.push({ key: isoWeekKey(ref), label: isoWeekKey(ref), start: ref.getTime() });
  }
  const throughputMap = new Map(weekBuckets.map((b) => [b.label, 0]));
  for (const [issueId, ts] of doneEventByIssue) {
    if (!scopedIds.has(issueId)) continue;
    if (daysAgo(ts) > 42) continue;
    const label = isoWeekKey(new Date(ts));
    if (throughputMap.has(label)) throughputMap.set(label, (throughputMap.get(label) ?? 0) + 1);
  }
  const throughput: ThroughputWeek[] = weekBuckets.map((b) => ({ label: b.label, done: throughputMap.get(b.label) ?? 0 }));

  // ---- Avg issue cycle time (created -> done), real, scoped done issues ----
  const cycleDurations: number[] = [];
  for (const i of scoped) {
    if (i.status !== DONE) continue;
    const doneAt = doneEventByIssue.get(i.id);
    if (!doneAt) continue;
    const d = (new Date(doneAt).getTime() - new Date(i.created_at).getTime()) / MS_DAY;
    if (d >= 0) cycleDurations.push(d);
  }
  const avgCycleDays = cycleDurations.length
    ? Math.round((cycleDurations.reduce((s, d) => s + d, 0) / cycleDurations.length) * 10) / 10
    : null;

  // ---- Narrative ("what changed", deterministic from real activity) ----
  const sevenDayDone = [...doneEventByIssue.entries()].filter(([id, ts]) => scopedIds.has(id) && daysAgo(ts) <= 7).length;
  const createdThisWeek = scoped.filter((i) => daysAgo(i.created_at) <= 7).length;
  const blockedCount = attentionTop.filter((a) => a.tag === "BLOCKED").length;
  const firstName = (nameRes.data?.name || input.email || "there").split(/[\s@]/)[0];

  const bits: string[] = [];
  if (sevenDayDone > 0) bits.push(`${sevenDayDone} issue${sevenDayDone === 1 ? "" : "s"} shipped`);
  if (createdThisWeek > 0) bits.push(`${createdThisWeek} new`);
  if (open > 0) bits.push(`${open} still open`);
  if (blockedCount > 0) bits.push(`${blockedCount} blocked`);
  const summary = bits.length ? bits.join(" · ") : "No activity yet — this is where your week comes together.";
  const narrative = `Welcome back, ${firstName}. ${scope === "mine" ? "Your" : "Team"} last 7 days: ${summary}.`;

  // ---- Issue-based DORA proxies ----
  const doneIssues = scoped.filter((i) => i.status === DONE);
  const doneBugs = doneIssues.filter((i) => i.type === "bug");
  const bugFailRate = doneIssues.length > 0
    ? Math.round((doneBugs.length / doneIssues.length) * 1000) / 10
    : null;

  const bugCycleDurations: number[] = [];
  for (const i of doneBugs) {
    const doneAt = doneEventByIssue.get(i.id);
    if (!doneAt) continue;
    const d = (new Date(doneAt).getTime() - new Date(i.created_at).getTime()) / MS_DAY;
    if (d >= 0) bugCycleDurations.push(d);
  }
  const avgBugCycleDays = bugCycleDurations.length
    ? Math.round((bugCycleDurations.reduce((s, d) => s + d, 0) / bugCycleDurations.length) * 10) / 10
    : null;

  // Avg issues done per week over last 4 weeks
  const last4 = throughput.slice(-4);
  const weeklyVelocity = last4.length > 0
    ? Math.round((last4.reduce((s, w) => s + w.done, 0) / last4.length) * 10) / 10
    : null;

  return {
    greetingName: firstName,
    scope,
    canSeeTeam,
    stats: { open, inProgress, doneThisWeek, unassigned },
    narrative,
    attention: attentionTop,
    portfolio,
    throughput,
    avgCycleDays,
    bugFailRate,
    avgBugCycleDays,
    weeklyVelocity,
    dora,
  };
}
