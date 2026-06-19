import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { projectsRepo, projectSpendRepo, type ProjectSpend, type ProjectStatus } from "@/lib/repositories/projects";
import { issuesRepo } from "@/lib/repositories/issues";
import { projectMembersRepo } from "@/lib/repositories/projectMembers";
import {
  ideasRepo,
  ideaDecisionsRepo,
  ideaSignoffsRepo,
  SIGNOFF_ROLES,
  type IdeaDecision,
  type IdeaSignoff,
} from "@/lib/repositories/ideas";

/**
 * Project portal ("Design G" Overview) — the single-project "where are we"
 * home. Everything here is REAL, derived from data that already exists
 * (issues + issue_events + the linked Think Tank idea + project team). No
 * migration required. Timeline (needs issue dates) and Costs (needs a budget
 * model) are separate tabs that activate behind migrations 0030/0031.
 */

export type Health = "on_track" | "at_risk" | "off_track" | "not_started";

const MS_DAY = 24 * 60 * 60 * 1000;
const STALE_DAYS = 14;

const STATUS_ORDER = ["backlog", "todo", "in_progress", "in_review", "done"];
const STATUS_META: Record<string, { label: string; color: string }> = {
  backlog: { label: "Backlog", color: "bg-neutral-300" },
  todo: { label: "Todo", color: "bg-sky-400" },
  in_progress: { label: "In progress", color: "bg-indigo-500" },
  in_review: { label: "In review", color: "bg-amber-400" },
  done: { label: "Done", color: "bg-emerald-500" },
};

export type BatterySegment = { key: string; label: string; count: number; color: string };
export type ProjectPortalData = {
  project: { id: string; key: string; name: string; status: ProjectStatus; startDate: string | null; targetGoLive: string | null };
  goLive: { days: number | null; label: string; tone: "neutral" | "good" | "warn" | "bad" };
  health: Health;
  attention: string[];
  battery: BatterySegment[];
  total: number;
  done: number;
  open: number;
  inProgress: number;
  pct: number;
  weekly: { label: string; done: number }[];
  hasWeeklyData: boolean;
  avgCycleDays: number | null;
  leadName: string | null;
  members: { name: string; role: string }[];
  provenance: { ideaId: string; ideaTitle: string } | null;
  decisions: IdeaDecision[];
  signoffs: IdeaSignoff[];
  signoffRoles: readonly string[];
  activity: { text: string; when: string }[];
};

function daysAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / MS_DAY;
}

function goLiveInfo(target: string | null): ProjectPortalData["goLive"] {
  if (!target) return { days: null, label: "No go-live date", tone: "neutral" };
  const days = Math.ceil((new Date(target + "T00:00:00").getTime() - Date.now()) / MS_DAY);
  if (days < 0) return { days, label: `Overdue by ${-days}d`, tone: "bad" };
  if (days === 0) return { days, label: "Go-live today", tone: "warn" };
  if (days <= 14) return { days, label: `Go-live in ${days}d`, tone: "warn" };
  return { days, label: `Go-live in ${days}d`, tone: "good" };
}

function isoWeekKey(d: Date): string {
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d.getTime() - day * MS_DAY);
  return monday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Load the portal for one project by key. Returns null if the project is absent. */
export async function loadProjectPortal(input: {
  tenantId: string;
  projectKey: string;
  impersonating: boolean;
}): Promise<ProjectPortalData | null> {
  const supabase = input.impersonating
    ? createSupabaseServiceClient()
    : await createSupabaseServerClient();

  const project = await projectsRepo(supabase).getByKey(input.tenantId, input.projectKey);
  if (!project) return null;

  const issues = await issuesRepo(supabase).listByProject(input.tenantId, project.id);
  const issueIds = issues.map((i) => i.id);

  // Recent status→done events + recent activity (fail open if events table empty).
  let events: { issue_id: string; field: string; new_value: string | null; actor_label: string | null; created_at: string }[] = [];
  if (issueIds.length > 0) {
    const { data } = await supabase
      .from("issue_events")
      .select("issue_id, field, new_value, actor_label, created_at")
      .eq("tenant_id", input.tenantId)
      .in("issue_id", issueIds)
      .order("created_at", { ascending: false })
      .limit(400);
    events = data ?? [];
  }

  // ---- Status battery (real distribution) ----
  const counts = new Map<string, number>();
  for (const i of issues) counts.set(i.status, (counts.get(i.status) ?? 0) + 1);
  const orderedKeys = [
    ...STATUS_ORDER.filter((k) => counts.has(k)),
    ...[...counts.keys()].filter((k) => !STATUS_ORDER.includes(k)),
  ];
  const battery: BatterySegment[] = orderedKeys.map((k) => ({
    key: k,
    label: STATUS_META[k]?.label ?? k.replace(/_/g, " "),
    count: counts.get(k) ?? 0,
    color: STATUS_META[k]?.color ?? "bg-neutral-400",
  }));

  const total = issues.length;
  const done = counts.get("done") ?? 0;
  const open = total - done;
  const inProgress = counts.get("in_progress") ?? 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

  // ---- Done-events index (for weekly throughput + cycle time) ----
  const doneAt = new Map<string, string>();
  for (const e of events) {
    if (e.field === "status" && e.new_value === "done" && !doneAt.has(e.issue_id)) {
      doneAt.set(e.issue_id, e.created_at);
    }
  }

  const weekBuckets: string[] = [];
  const now = new Date();
  for (let w = 5; w >= 0; w--) weekBuckets.push(isoWeekKey(new Date(now.getTime() - w * 7 * MS_DAY)));
  const weeklyMap = new Map(weekBuckets.map((k) => [k, 0]));
  let weeklyTotal = 0;
  for (const ts of doneAt.values()) {
    if (daysAgo(ts) > 42) continue;
    const k = isoWeekKey(new Date(ts));
    if (weeklyMap.has(k)) {
      weeklyMap.set(k, (weeklyMap.get(k) ?? 0) + 1);
      weeklyTotal++;
    }
  }
  const weekly = weekBuckets.map((k) => ({ label: k, done: weeklyMap.get(k) ?? 0 }));

  const cycle: number[] = [];
  for (const i of issues) {
    if (i.status !== "done") continue;
    const ts = doneAt.get(i.id);
    if (!ts) continue;
    const d = (new Date(ts).getTime() - new Date(i.created_at).getTime()) / MS_DAY;
    if (d >= 0) cycle.push(d);
  }
  const avgCycleDays = cycle.length ? Math.round((cycle.reduce((s, d) => s + d, 0) / cycle.length) * 10) / 10 : null;

  // ---- Attention reasons (explainable) + health ----
  const goLive = goLiveInfo(project.target_go_live);
  const unassigned = issues.filter((i) => !i.assignee_id && i.status !== "done").length;
  const blocked = issues.filter((i) => i.status !== "done" && (i.labels ?? []).some((l) => l.toLowerCase().includes("block"))).length;
  const stale = issues.filter((i) => i.status !== "done" && daysAgo(i.updated_at) > STALE_DAYS).length;
  const lastActivity = events[0]?.created_at ?? null;
  const quietDays = lastActivity ? Math.round(daysAgo(lastActivity)) : null;

  // Behind pace: fraction of time elapsed vs fraction of work done.
  let behindPace = false;
  if (project.start_date && project.target_go_live && total > 0) {
    const start = new Date(project.start_date + "T00:00:00").getTime();
    const end = new Date(project.target_go_live + "T00:00:00").getTime();
    if (end > start) {
      const elapsed = (Date.now() - start) / (end - start);
      behindPace = elapsed > 0.15 && pct / 100 < elapsed - 0.1;
    }
  }

  const attention: string[] = [];
  if (goLive.days != null && goLive.days < 0 && open > 0) attention.push(`Go-live overdue by ${-goLive.days} days with ${open} open`);
  else if (behindPace && goLive.days != null) attention.push(`${pct}% done with go-live in ${goLive.days}d — behind pace`);
  if (blocked > 0) attention.push(`${blocked} blocked`);
  if (unassigned > 0) attention.push(`${unassigned} unassigned`);
  if (stale > 0) attention.push(`${stale} stale (no update 14d+)`);
  if (quietDays != null && quietDays >= STALE_DAYS && open > 0) attention.push(`no activity in ${quietDays} days`);

  let health: Health;
  if (total === 0) health = "not_started";
  else if (goLive.days != null && goLive.days < 0 && open > 0) health = "off_track";
  else if (attention.length > 0) health = "at_risk";
  else health = "on_track";

  // ---- Team ----
  const memberRows = await projectMembersRepo(supabase).list(input.tenantId, project.id);
  const members = memberRows.map((m) => ({ name: m.name ?? m.email, role: m.role }));
  let leadName: string | null = null;
  if (project.lead_user_id) {
    const { data } = await supabase.from("users").select("name, email").eq("id", project.lead_user_id).maybeSingle();
    leadName = data ? (data.name ?? data.email) : null;
  }

  // ---- Provenance (origin idea + decisions + sign-offs) ----
  let provenance: ProjectPortalData["provenance"] = null;
  let decisions: IdeaDecision[] = [];
  let signoffs: IdeaSignoff[] = [];
  if (project.linked_idea_id) {
    const idea = await ideasRepo(supabase).getById(input.tenantId, project.linked_idea_id);
    if (idea) {
      provenance = { ideaId: idea.id, ideaTitle: idea.title };
      decisions = await ideaDecisionsRepo(supabase).list(input.tenantId, idea.id);
      // Fails open if migration 0029 hasn't been run.
      signoffs = await ideaSignoffsRepo(supabase).list(input.tenantId, idea.id).catch(() => []);
    }
  }

  // ---- Recent activity (formatted) ----
  const activity = events.slice(0, 8).map((e) => {
    const who = e.actor_label ?? "Someone";
    let what: string;
    if (e.field === "status") what = `moved an issue to ${(e.new_value ?? "").replace(/_/g, " ")}`;
    else if (e.field === "assignee") what = "changed an assignee";
    else what = `updated ${e.field}`;
    return { text: `${who} ${what}`, when: relTime(e.created_at) };
  });

  return {
    project: {
      id: project.id,
      key: project.key,
      name: project.name,
      status: project.status,
      startDate: project.start_date,
      targetGoLive: project.target_go_live,
    },
    goLive,
    health,
    attention,
    battery,
    total,
    done,
    open,
    inProgress,
    pct,
    weekly,
    hasWeeklyData: weeklyTotal > 0,
    avgCycleDays,
    leadName,
    members,
    provenance,
    decisions,
    signoffs,
    signoffRoles: SIGNOFF_ROLES,
    activity,
  };
}

function relTime(iso: string): string {
  const d = daysAgo(iso);
  if (d < 1 / 24) return "just now";
  if (d < 1) return `${Math.round(d * 24)}h ago`;
  if (d < 2) return "yesterday";
  return `${Math.round(d)}d ago`;
}

// ---------------------------------------------------------------------------
// Costs tab data — simple budget + spend
// ---------------------------------------------------------------------------

export type ProjectCostsData = {
  projectId: string;
  budgetCents: number | null;
  spentCents: number;
  remainingCents: number;
  pct: number;
  entries: ProjectSpend[];
};

export async function loadProjectCosts(input: {
  tenantId: string;
  projectKey: string;
  impersonating: boolean;
}): Promise<ProjectCostsData | null> {
  const supabase = input.impersonating
    ? createSupabaseServiceClient()
    : await createSupabaseServerClient();

  const project = await projectsRepo(supabase).getByKey(input.tenantId, input.projectKey);
  if (!project) return null;

  const entries = await projectSpendRepo(supabase).list(input.tenantId, project.id);
  const spentCents = entries.reduce((s, e) => s + e.amountCents, 0);
  const budgetCents = project.budget_cents;
  const remainingCents = budgetCents != null ? budgetCents - spentCents : 0;
  const pct = budgetCents && budgetCents > 0 ? Math.round((spentCents / budgetCents) * 100) : 0;

  return { projectId: project.id, budgetCents, spentCents, remainingCents, pct, entries };
}

// ---------------------------------------------------------------------------
// Timeline tab data — issues on a track by start/due date
// ---------------------------------------------------------------------------

export type TimelineBar = {
  id: string;
  ref: string;
  title: string;
  status: string;
  color: string;
  startPct: number;
  endPct: number;
};

export type ProjectTimelineData = {
  bars: TimelineBar[];
  todayPct: number | null;
  goLivePct: number | null;
  rangeStartLabel: string;
  rangeEndLabel: string;
  scheduledCount: number;
  totalCount: number;
};

function dateMs(d: string): number {
  return new Date(d + "T00:00:00").getTime();
}
function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function loadProjectTimeline(input: {
  tenantId: string;
  projectKey: string;
  impersonating: boolean;
}): Promise<ProjectTimelineData | null> {
  const supabase = input.impersonating
    ? createSupabaseServiceClient()
    : await createSupabaseServerClient();

  const project = await projectsRepo(supabase).getByKey(input.tenantId, input.projectKey);
  if (!project) return null;

  const issues = await issuesRepo(supabase).listByProject(input.tenantId, project.id);
  const scheduled = issues.filter((i) => i.start_date || i.due_date);

  const empty: ProjectTimelineData = {
    bars: [],
    todayPct: null,
    goLivePct: null,
    rangeStartLabel: "",
    rangeEndLabel: "",
    scheduledCount: 0,
    totalCount: issues.length,
  };
  if (scheduled.length === 0) return empty;

  // Window = earliest to latest of all relevant dates, padded a touch.
  const points: number[] = [];
  for (const i of scheduled) {
    if (i.start_date) points.push(dateMs(i.start_date));
    if (i.due_date) points.push(dateMs(i.due_date));
  }
  if (project.start_date) points.push(dateMs(project.start_date));
  if (project.target_go_live) points.push(dateMs(project.target_go_live));
  points.push(Date.now());

  let min = Math.min(...points);
  let max = Math.max(...points);
  const pad = Math.max((max - min) * 0.04, MS_DAY);
  min -= pad;
  max += pad;
  const span = max - min || 1;
  const pct = (ms: number) => Math.max(0, Math.min(100, ((ms - min) / span) * 100));

  const bars: TimelineBar[] = scheduled
    .map((i) => {
      const s = i.start_date ? dateMs(i.start_date) : dateMs(i.due_date!);
      const e = i.due_date ? dateMs(i.due_date) : dateMs(i.start_date!);
      const lo = Math.min(s, e);
      const hi = Math.max(s, e);
      const startPct = pct(lo);
      const endPct = Math.max(pct(hi), startPct + 1.5); // ensure a visible sliver
      return {
        id: i.id,
        ref: `${project.key}-${i.number}`,
        title: i.title,
        status: i.status,
        color: STATUS_META[i.status]?.color ?? "bg-neutral-400",
        startPct,
        endPct,
      };
    })
    .sort((a, b) => a.startPct - b.startPct);

  const nowMs = Date.now();
  const goLiveMs = project.target_go_live ? dateMs(project.target_go_live) : null;

  return {
    bars,
    todayPct: nowMs >= min && nowMs <= max ? pct(nowMs) : null,
    goLivePct: goLiveMs != null && goLiveMs >= min && goLiveMs <= max ? pct(goLiveMs) : null,
    rangeStartLabel: shortDate(min),
    rangeEndLabel: shortDate(max),
    scheduledCount: scheduled.length,
    totalCount: issues.length,
  };
}
