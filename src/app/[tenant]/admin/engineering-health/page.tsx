import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role required for cross-tenant aggregate queries
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import EngineeringHealthDashboard from "./EngineeringHealthDashboard";

export const revalidate = 300; // refresh every 5 min

interface IssueRow {
  id: string;
  status: string;
  priority: string;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
  project_id: string;
}

interface EventRow {
  issue_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface CycleEntry {
  issueId: string;
  startedAt: string;
  completedAt: string;
  days: number;
}

export interface WeekBucket {
  label: string; // "Jun 9"
  done: number;
}

export interface EngHealthData {
  wip: number;
  blockedP1: number; // urgent, unowned, open > 24h
  avgCycleDays: number | null;
  p50CycleDays: number | null;
  throughputLast4Weeks: WeekBucket[];
  openByPriority: { urgent: number; high: number; medium: number; low: number };
  cycleEntries: CycleEntry[]; // last 20 completed for sparkline
  longestOpenIssueDays: number;
  percentDoneThisWeek: number;
  totalOpen: number;
}

function weekLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysBetween(a: string, b: string): number {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

async function loadEngHealth(tenantId: string): Promise<EngHealthData> {
  const svc = createSupabaseServiceClient();
  const now = new Date();
  const fourWeeksAgo = new Date(now.getTime() - 28 * 86_400_000);

  const [issuesRes, eventsRes] = await Promise.all([
    svc
      .from("issues")
      .select("id, status, priority, assignee_id, created_at, updated_at, project_id")
      .eq("tenant_id", tenantId),
    svc
      .from("issue_events")
      .select("issue_id, field, old_value, new_value, created_at")
      .eq("tenant_id", tenantId)
      .eq("field", "status")
      .gte("created_at", fourWeeksAgo.toISOString()),
  ]);

  const issues: IssueRow[] = (issuesRes.data ?? []) as IssueRow[];
  const events: EventRow[] = (eventsRes.data ?? []) as EventRow[];

  // WIP: issues in in_progress or in_review
  const open = issues.filter((i) => !["done", "backlog"].includes(i.status));
  const wip = issues.filter((i) => i.status === "in_progress" || i.status === "in_review").length;
  const totalOpen = open.length;

  // Blocked P1s: urgent, unassigned, open > 24h
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const blockedP1 = open.filter(
    (i) => i.priority === "urgent" && !i.assignee_id && new Date(i.created_at) < dayAgo
  ).length;

  // Open by priority
  const openByPriority = { urgent: 0, high: 0, medium: 0, low: 0 };
  for (const i of open) {
    if (i.priority in openByPriority) openByPriority[i.priority as keyof typeof openByPriority]++;
  }

  // Longest open issue
  const longestOpenIssueDays = Math.round(
    Math.max(0, ...open.map((i) => daysBetween(i.created_at, now.toISOString())))
  );

  // Cycle time: find in_progress start + done end per issue from events
  const inProgressAt: Record<string, string> = {};
  const doneAt: Record<string, string> = {};

  for (const ev of events) {
    if (ev.new_value === "in_progress" && !inProgressAt[ev.issue_id]) {
      inProgressAt[ev.issue_id] = ev.created_at;
    }
    if (ev.new_value === "done") {
      doneAt[ev.issue_id] = ev.created_at;
    }
  }

  const cycleEntries: CycleEntry[] = [];
  for (const [issueId, startedAt] of Object.entries(inProgressAt)) {
    const completedAt = doneAt[issueId];
    if (completedAt) {
      const days = Math.max(0, daysBetween(startedAt, completedAt));
      cycleEntries.push({ issueId, startedAt, completedAt, days });
    }
  }
  cycleEntries.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  const cycleDays = cycleEntries.map((e) => e.days);
  const avgCycleDays = cycleDays.length
    ? Math.round((cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length) * 10) / 10
    : null;
  const sorted = [...cycleDays].sort((a, b) => a - b);
  const p50CycleDays = sorted.length ? Math.round(sorted[Math.floor(sorted.length / 2)] * 10) / 10 : null;

  // Throughput: issues moved to done per week over last 4 weeks
  const weekBuckets: WeekBucket[] = Array.from({ length: 4 }, (_, i) => {
    const weekStart = new Date(now.getTime() - (3 - i) * 7 * 86_400_000);
    weekStart.setHours(0, 0, 0, 0);
    return { label: weekLabel(weekStart), done: 0 };
  });

  for (const ev of events) {
    if (ev.new_value !== "done") continue;
    const evDate = new Date(ev.created_at);
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(now.getTime() - (3 - i) * 7 * 86_400_000);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
      if (evDate >= weekStart && evDate < weekEnd) {
        weekBuckets[i].done++;
        break;
      }
    }
  }

  // % done this week
  const thisWeekDone = weekBuckets[3]?.done ?? 0;
  const thisWeekTotal = totalOpen + thisWeekDone;
  const percentDoneThisWeek =
    thisWeekTotal > 0 ? Math.round((thisWeekDone / thisWeekTotal) * 100) : 0;

  return {
    wip,
    blockedP1,
    avgCycleDays,
    p50CycleDays,
    throughputLast4Weeks: weekBuckets,
    openByPriority,
    cycleEntries: cycleEntries.slice(0, 20),
    longestOpenIssueDays,
    percentDoneThisWeek,
    totalOpen,
  };
}

export default async function EngineeringHealthPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const data = await loadEngHealth(ctx.tenant.id);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Engineering Health</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Cycle time, WIP, throughput, and team health metrics from your issue board.
        </p>
      </div>
      <EngineeringHealthDashboard data={data} />
    </div>
  );
}
