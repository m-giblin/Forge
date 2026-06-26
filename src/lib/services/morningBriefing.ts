/**
 * Morning Briefing data service.
 * Powers the role-aware "Good Morning" home page for Developer, PM, and Admin.
 * All queries run via service-role client (impersonation-safe, used by server component).
 * No new migrations needed — everything is derived from existing tables.
 */
import "server-only";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getLatestStandupDigest, type StandupDigest } from "@/lib/services/standupDigest";

// ── Types ─────────────────────────────────────────────────────────────────

export type BriefingIssue = {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  projectKey: string;
  dueDate: string | null;
  isOverdue: boolean;
  sprintId: string | null;
};

export type SprintHealth = {
  id: string;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  daysLeft: number | null;
  total: number;
  done: number;
  inProgressCount: number;
  inReview: number;
  blocked: number;
  pctDone: number;
  projectName: string;
  projectKey: string;
  issues: BriefingIssue[];
};

export type WorkloadEntry = {
  userId: string | null;
  name: string;
  openCount: number;
  blockedCount: number;
  urgentCount: number;
};

export type BlockerIssue = {
  id: string;
  number: number;
  title: string;
  projectKey: string;
  assigneeName: string;
  daysBlocked: number;
  priority: string;
};

export type ProjectSprintSummary = {
  projectId: string;
  projectKey: string;
  projectName: string;
  sprint: SprintHealth | null;
  openCount: number;
  doneCount: number;
  blockedCount: number;
  overdueCount: number;
};

export type MemberActivityEntry = {
  userId: string;
  name: string;
  issuesUpdatedLast7d: number;
  issuesOwned: number;
  lastActiveLabel: string;
};

export type TenantStats = {
  totalOpen: number;
  totalDone: number;
  blocked: number;
  unassigned: number;
  overdueOpen: number;
  inProgressCount: number;
};

export type MorningBriefing = {
  // Universal
  digest: StandupDigest | null;
  digestFresh: boolean;           // false = cache miss, generated live
  // Developer view
  myIssues: BriefingIssue[];
  activeSprints: SprintHealth[];  // sprints where the user has at least 1 issue
  primarySprint: SprintHealth | null;  // first/most relevant active sprint
  unreadMentions: number;
  // PM view
  projectSprints: ProjectSprintSummary[];
  teamWorkload: WorkloadEntry[];
  blockers: BlockerIssue[];
  overdueIssues: BriefingIssue[];
  // Admin view
  tenantStats: TenantStats;
  memberActivity: MemberActivityEntry[];
  unownedCount: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────

function daysLeft(endDate: string | null): number | null {
  if (!endDate) return null;
  const diff = new Date(endDate + "T23:59:59").getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate + "T23:59:59").getTime() < Date.now();
}

function daysAgo(ts: string): number {
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000);
}

function lastActiveLabel(daysAgoN: number): string {
  if (daysAgoN === 0) return "Active today";
  if (daysAgoN === 1) return "Active yesterday";
  if (daysAgoN <= 6) return `Active ${daysAgoN}d ago`;
  return "Quiet this week";
}

// ── Main loader ───────────────────────────────────────────────────────────

export async function loadMorningBriefing({
  tenantId,
  appUserId,
}: {
  tenantId: string;
  appUserId: string;
}): Promise<MorningBriefing> {
  const svc = createSupabaseServiceClient();

  // ── Parallel data fetch ──────────────────────────────────────────────
  const [
    allIssuesRaw,
    sprintsRaw,
    projectsRaw,
    membersRaw,
    notifCountRaw,
    digestCached,
    activityRaw,
  ] = await Promise.all([
    // All non-done issues for this tenant (+ recent done for digest context)
    svc
      .from("issues")
      .select("id, number, title, status, priority, project_id, assignee_id, due_date, sprint_id, updated_at, created_at")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(500),

    // All active sprints
    svc
      .from("sprints")
      .select("id, name, goal, status, start_date, end_date, project_id")
      .eq("tenant_id", tenantId)
      .eq("status", "active"),

    // All projects
    svc
      .from("projects")
      .select("id, key, name, status")
      .eq("tenant_id", tenantId),

    // All members (for name lookup)
    svc
      .from("memberships")
      .select("user_id, role, user:users!inner(id, name, email)")
      .eq("tenant_id", tenantId),

    // Unread mentions for this user
    svc
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("user_id", appUserId)
      .eq("read", false),

    // Cached digest
    getLatestStandupDigest(tenantId),

    // Issues updated in last 7 days (for member activity)
    svc
      .from("issues")
      .select("assignee_id, updated_at")
      .eq("tenant_id", tenantId)
      .gte("updated_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
  ]);

  const allIssues = allIssuesRaw.data ?? [];
  const sprints   = sprintsRaw.data ?? [];
  const projects  = projectsRaw.data ?? [];
  const members = ((membersRaw.data ?? []) as unknown) as Array<{
    user_id: string; role: string;
    user: { id: string; name: string | null; email: string };
  }>;
  const unreadMentions = notifCountRaw.count ?? 0;
  const recentActivity = activityRaw.data ?? [];

  // Name lookup maps
  const projectById  = new Map(projects.map((p) => [p.id as string, p]));
  const memberByUserId = new Map(
    members.map((m) => [m.user_id, { name: m.user.name ?? m.user.email, role: m.role }])
  );

  const openIssues = allIssues.filter((i) => i.status !== "done" && i.status !== "closed");

  // ── Helper: map raw issue to BriefingIssue ───────────────────────────
  function toBI(i: typeof allIssues[0]): BriefingIssue {
    const proj = projectById.get(i.project_id as string);
    return {
      id:         i.id as string,
      number:     i.number as number,
      title:      i.title as string,
      status:     i.status as string,
      priority:   i.priority as string,
      projectKey: proj?.key ?? "?",
      dueDate:    i.due_date as string | null,
      isOverdue:  isOverdue(i.due_date as string | null),
      sprintId:   i.sprint_id as string | null,
    };
  }

  // ── Build sprint health objects ──────────────────────────────────────
  function buildSprintHealth(sprint: typeof sprints[0], issues: typeof allIssues): SprintHealth {
    const proj = projectById.get(sprint.project_id as string);
    const sprintIssues = issues.filter((i) => i.sprint_id === sprint.id);
    const total    = sprintIssues.length;
    const done     = sprintIssues.filter((i) => i.status === "done").length;
    const inProg   = sprintIssues.filter((i) => i.status === "in_progress").length;
    const inReview = sprintIssues.filter((i) => i.status === "in_review").length;
    const blocked  = sprintIssues.filter((i) => i.status === "blocked").length;
    return {
      id:          sprint.id as string,
      name:        sprint.name as string,
      goal:        sprint.goal as string | null,
      startDate:   sprint.start_date as string | null,
      endDate:     sprint.end_date as string | null,
      daysLeft:    daysLeft(sprint.end_date as string | null),
      total, done, inProgressCount: inProg, inReview, blocked,
      pctDone:     total > 0 ? Math.round((done / total) * 100) : 0,
      projectName: proj?.name ?? "",
      projectKey:  proj?.key ?? "?",
      issues:      sprintIssues.map(toBI),
    };
  }

  const allSprintHealths = sprints.map((s) => buildSprintHealth(s, allIssues));

  // ── DEVELOPER VIEW ───────────────────────────────────────────────────

  const myIssues = openIssues
    .filter((i) => i.assignee_id === appUserId)
    .map(toBI)
    .sort((a, b) => {
      const PRI = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (PRI[a.priority as keyof typeof PRI] ?? 9) - (PRI[b.priority as keyof typeof PRI] ?? 9);
    });

  // Active sprints where this user has issues
  const mySprintIds = new Set(myIssues.map((i) => i.sprintId).filter(Boolean));
  const activeSprints = allSprintHealths.filter(
    (s) => mySprintIds.has(s.id) || s.issues.some((i) => i.sprintId === s.id && i.status !== "done")
  );
  const primarySprint = activeSprints[0] ?? allSprintHealths[0] ?? null;

  // ── PM VIEW ──────────────────────────────────────────────────────────

  const projectSprints: ProjectSprintSummary[] = projects
    .filter((p) => p.status === "active" || p.status === "on_hold")
    .map((proj) => {
      const projIssues  = openIssues.filter((i) => i.project_id === proj.id);
      const sprint      = allSprintHealths.find((s) => s.projectKey === proj.key) ?? null;
      const allProjIssues = allIssues.filter((i) => i.project_id === proj.id);
      return {
        projectId:    proj.id as string,
        projectKey:   proj.key as string,
        projectName:  proj.name as string,
        sprint,
        openCount:    projIssues.length,
        doneCount:    allProjIssues.filter((i) => i.status === "done").length,
        blockedCount: projIssues.filter((i) => i.status === "blocked").length,
        overdueCount: projIssues.filter((i) => isOverdue(i.due_date as string | null)).length,
      };
    })
    .sort((a, b) => (b.blockedCount + b.overdueCount) - (a.blockedCount + a.overdueCount));

  // Team workload
  const workloadMap = new Map<string | null, { name: string; open: number; blocked: number; urgent: number }>();
  for (const i of openIssues) {
    const uid  = i.assignee_id as string | null;
    const name = uid ? (memberByUserId.get(uid)?.name ?? "Unknown") : "Unassigned";
    const key  = uid ?? "__unassigned__";
    const entry = workloadMap.get(key) ?? { name, open: 0, blocked: 0, urgent: 0 };
    entry.open++;
    if (i.status === "blocked") entry.blocked++;
    if (i.priority === "urgent") entry.urgent++;
    workloadMap.set(key, entry);
  }
  const teamWorkload: WorkloadEntry[] = [...workloadMap.entries()]
    .map(([uid, e]) => ({
      userId:       uid === "__unassigned__" ? null : uid,
      name:         e.name,
      openCount:    e.open,
      blockedCount: e.blocked,
      urgentCount:  e.urgent,
    }))
    .sort((a, b) => b.openCount - a.openCount)
    .slice(0, 12);

  // Blockers
  const blockers: BlockerIssue[] = openIssues
    .filter((i) => i.status === "blocked")
    .map((i) => {
      const proj = projectById.get(i.project_id as string);
      const assigneeName = i.assignee_id
        ? (memberByUserId.get(i.assignee_id as string)?.name ?? "Unknown")
        : "Unassigned";
      return {
        id:           i.id as string,
        number:       i.number as number,
        title:        i.title as string,
        projectKey:   proj?.key ?? "?",
        assigneeName,
        daysBlocked:  daysAgo(i.updated_at as string),
        priority:     i.priority as string,
      };
    })
    .sort((a, b) => b.daysBlocked - a.daysBlocked);

  const overdueIssues = openIssues
    .filter((i) => isOverdue(i.due_date as string | null))
    .map(toBI)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  // ── ADMIN VIEW ───────────────────────────────────────────────────────

  const tenantStats: TenantStats = {
    totalOpen:      openIssues.length,
    totalDone:      allIssues.filter((i) => i.status === "done").length,
    blocked:        blockers.length,
    unassigned:     openIssues.filter((i) => !i.assignee_id).length,
    overdueOpen:    overdueIssues.length,
    inProgressCount: openIssues.filter((i) => i.status === "in_progress").length,
  };

  // Member activity: issues updated in last 7 days grouped by assignee
  const actByUser = new Map<string, number>();
  for (const r of recentActivity) {
    if (!r.assignee_id) continue;
    actByUser.set(r.assignee_id as string, (actByUser.get(r.assignee_id as string) ?? 0) + 1);
  }

  const memberActivity: MemberActivityEntry[] = members.map((m) => {
    const ownedCount = openIssues.filter((i) => i.assignee_id === m.user_id).length;
    const updCount   = actByUser.get(m.user_id) ?? 0;
    // Find most recently updated issue this user touched
    const lastIssue  = recentActivity.filter((r) => r.assignee_id === m.user_id)[0];
    const dAgo       = lastIssue ? daysAgo(lastIssue.updated_at as string) : 99;
    return {
      userId:              m.user_id,
      name:                m.user.name ?? m.user.email,
      issuesUpdatedLast7d: updCount,
      issuesOwned:         ownedCount,
      lastActiveLabel:     lastActiveLabel(dAgo),
    };
  }).sort((a, b) => b.issuesUpdatedLast7d - a.issuesUpdatedLast7d);

  // ── Digest: read from cache only — generation is owned by the 6am cron ──
  // Never block a page render on an AI call. The cron at /api/cron/standup-digest
  // pre-generates per tenant and stores in platform_config. Null here = no digest
  // yet today; the banner shows a "generates at 6am" message instead.
  const digest = digestCached;
  const digestFresh = digest
    ? (Date.now() - new Date(digest.generated_at).getTime()) / 3_600_000 < 20
    : false;

  return {
    digest,
    digestFresh,
    myIssues,
    activeSprints,
    primarySprint,
    unreadMentions,
    projectSprints,
    teamWorkload,
    blockers,
    overdueIssues,
    tenantStats,
    memberActivity,
    unownedCount: tenantStats.unassigned,
  };
}
