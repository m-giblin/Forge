import { redirect } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-neutral-100 text-neutral-600",
  in_progress: "bg-blue-100 text-blue-700",
  in_review: "bg-purple-100 text-purple-700",
  done: "bg-green-100 text-green-700",
  blocked: "bg-red-100 text-red-700",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-neutral-100 text-neutral-600",
};

const PRIORITY_ORDER = ["urgent", "high", "medium", "low"];

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function relativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type AssignedIssue = {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string | null;
  type: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  project: { key: string; name: string } | null;
};

export default async function AssignedPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const supabase = await createSupabaseServerClient();

  const sevenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 7)).toISOString();

  const [openRes, doneRes] = await Promise.all([
    supabase
      .from("issues")
      .select("id, number, title, status, priority, type, due_date, created_at, updated_at, project:project_id(key, name)")
      .eq("assignee_id", ctx.appUserId)
      .eq("tenant_id", ctx.tenant.id)
      .neq("status", "done")
      .order("updated_at", { ascending: false }),
    supabase
      .from("issues")
      .select("id", { count: "exact", head: true })
      .eq("assignee_id", ctx.appUserId)
      .eq("tenant_id", ctx.tenant.id)
      .eq("status", "done")
      .gte("updated_at", sevenDaysAgo),
  ]);

  const issues = (openRes.data ?? []) as unknown as AssignedIssue[];
  const completedThisWeek = doneRes.count ?? 0;

  const openCount = issues.filter((i) => i.status === "todo").length;
  const inProgressCount = issues.filter((i) => i.status === "in_progress").length;

  // Group by priority
  const grouped = new Map<string, AssignedIssue[]>();
  for (const p of PRIORITY_ORDER) grouped.set(p, []);
  grouped.set("none", []);
  for (const issue of issues) {
    const key = issue.priority && PRIORITY_ORDER.includes(issue.priority) ? issue.priority : "none";
    grouped.get(key)!.push(issue);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <main className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Assigned to Me</h1>
        <p className="mt-1 text-sm text-neutral-500">Your open issues across all projects.</p>
      </div>

      {/* Stats bar */}
      <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm">
        <span className="text-neutral-700">
          <span className="font-semibold text-neutral-900">{openCount}</span> open
        </span>
        <span className="text-neutral-300">·</span>
        <span className="text-neutral-700">
          <span className="font-semibold text-neutral-900">{inProgressCount}</span> in progress
        </span>
        <span className="text-neutral-300">·</span>
        <span className="text-neutral-700">
          <span className="font-semibold text-neutral-900">{completedThisWeek}</span> completed this week
        </span>
      </div>

      {issues.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-6 py-16 text-center">
          <p className="text-sm text-neutral-500">No open issues assigned to you. 🎉</p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...PRIORITY_ORDER, "none"].map((priority) => {
            const group = grouped.get(priority) ?? [];
            if (group.length === 0) return null;
            const label = priority === "none" ? "No Priority" : priority.charAt(0).toUpperCase() + priority.slice(1);
            return (
              <section key={priority}>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  {priority !== "none" && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_COLORS[priority] ?? "bg-neutral-100 text-neutral-600"}`}>
                      {label}
                    </span>
                  )}
                  {priority === "none" && label}
                  <span className="font-normal">({group.length})</span>
                </h2>
                <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
                  {group.map((issue) => {
                    const dueDate = issue.due_date ? new Date(issue.due_date) : null;
                    const isOverdue = dueDate && dueDate < today;
                    return (
                      <Link
                        key={issue.id}
                        href={`/${slug}/issues/${issue.id}`}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors"
                      >
                        <span className="mt-0.5 shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-xs font-mono font-medium text-neutral-600">
                          {issue.project?.key ?? "?"}-{issue.number}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div
                            className="block truncate text-sm font-medium text-neutral-800 hover:underline"
                          >
                            {issue.title}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[issue.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                              {statusLabel(issue.status)}
                            </span>
                            {issue.project && (
                              <span className="text-neutral-400">{issue.project.name}</span>
                            )}
                            {dueDate && (
                              <>
                                <span className="text-neutral-300">·</span>
                                <span className={isOverdue ? "font-medium text-red-600" : "text-neutral-400"}>
                                  Due {dueDate.toLocaleDateString()}
                                  {isOverdue && " (overdue)"}
                                </span>
                              </>
                            )}
                            <span className="text-neutral-300">·</span>
                            <span>{relativeTime(issue.updated_at)}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
