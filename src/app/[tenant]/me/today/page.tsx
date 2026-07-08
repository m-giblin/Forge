import { redirect } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: cross-project issue read for current user (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#6366f1",
  low: "#9ca3af",
};

const STATUS_LABEL: Record<string, string> = {
  in_progress: "In Progress",
  todo: "To Do",
  in_review: "In Review",
  backlog: "Backlog",
};

type FocusIssue = {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  projectKey: string;
  sprintName: string | null;
  isOverdue: boolean;
};

function IssueRow({ issue, slug }: { issue: FocusIssue; slug: string }) {
  const prColor = PRIORITY_COLOR[issue.priority] ?? "#9ca3af";
  return (
    <Link
      href={`/${slug}/issues/${issue.id}`}
      className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 hover:border-neutral-300 hover:shadow-sm transition group"
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: prColor }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900 truncate group-hover:text-indigo-600 transition-colors">
          {issue.title}
        </p>
        <p className="text-xs text-neutral-400 mt-0.5">
          {issue.projectKey}-{issue.number}
          {issue.sprintName && <> · {issue.sprintName}</>}
          {issue.dueDate && (
            <span className={issue.isOverdue ? "text-red-500 font-medium" : ""}>
              {" "}· Due {fmtDate(issue.dueDate)}
            </span>
          )}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
        {STATUS_LABEL[issue.status] ?? issue.status}
      </span>
    </Link>
  );
}

function FocusSection({ title, items, accent, slug }: { title: string; items: FocusIssue[]; accent?: string; slug: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className={`text-xs font-semibold uppercase tracking-widest mb-3 ${accent ?? "text-neutral-400"}`}>
        {title} <span className="font-normal">({items.length})</span>
      </h2>
      <div className="space-y-2">
        {items.map((i) => <IssueRow key={i.id} issue={i} slug={slug} />)}
      </div>
    </div>
  );
}

export default async function MyTodayPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);

  const svc = createSupabaseServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // All issues assigned to me that are not done/closed/archived
  const { data: rows } = await svc
    .from("issues")
    .select("id, number, title, status, priority, due_date, project_id, sprint_id")
    .eq("tenant_id", ctx.tenant.id)
    .eq("assignee_id", ctx.appUserId)
    .not("status", "in", '("done","closed","archived")')
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(100);

  if (!rows || rows.length === 0) {
    return (
      <main className="max-w-xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-neutral-900">My Day</h1>
        <p className="mt-2 text-sm text-neutral-500">Nothing assigned to you right now. Enjoy the quiet.</p>
      </main>
    );
  }

  // Enrich with project key + sprint name
  const projectIds = [...new Set(rows.map((r) => r.project_id as string))];
  const sprintIds = [...new Set(rows.map((r) => r.sprint_id as string).filter(Boolean))];

  const [projRes, sprintRes] = await Promise.all([
    svc.from("projects").select("id, key").in("id", projectIds),
    sprintIds.length
      ? svc.from("sprints").select("id, name").in("id", sprintIds)
      : Promise.resolve({ data: [] }),
  ]);

  const projMap = new Map((projRes.data ?? []).map((p) => [p.id as string, p.key as string]));
  const sprintMap = new Map((sprintRes.data ?? []).map((s) => [s.id as string, s.name as string]));

  const issues: FocusIssue[] = rows.map((r) => ({
    id: r.id as string,
    number: r.number as number,
    title: r.title as string,
    status: r.status as string,
    priority: r.priority as string,
    dueDate: r.due_date as string | null,
    projectKey: projMap.get(r.project_id as string) ?? "?",
    sprintName: r.sprint_id ? (sprintMap.get(r.sprint_id as string) ?? null) : null,
    isOverdue: !!r.due_date && (r.due_date as string) < today,
  }));

  const overdue = issues.filter((i) => i.isOverdue);
  const inProgress = issues.filter((i) => !i.isOverdue && i.status === "in_progress");
  const todo = issues.filter((i) => !i.isOverdue && i.status !== "in_progress");

  return (
    <main className="max-w-2xl px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">My Day</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {issues.length} issue{issues.length !== 1 ? "s" : ""} assigned to you ·{" "}
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      <FocusSection title="Overdue" items={overdue} accent="text-red-500" slug={slug} />
      <FocusSection title="In Progress" items={inProgress} accent="text-indigo-600" slug={slug} />
      <FocusSection title="Up Next" items={todo} slug={slug} />
    </main>
  );
}
