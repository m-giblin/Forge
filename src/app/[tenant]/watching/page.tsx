import { redirect } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- service-role required: member name lookup bypasses RLS by design
import { createSupabaseServiceClient } from "@/lib/supabase/service";

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

const STATUS_ORDER = ["in_progress", "in_review", "blocked", "todo", "done"];

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

type WatchedIssue = {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string | null;
  type: string | null;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
  project: { key: string; name: string } | null;
};

export default async function WatchingPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const supabase = await createSupabaseServerClient();

  // Get watched issue IDs
  const { data: watcherRows } = await supabase
    .from("issue_watchers")
    .select("issue_id")
    .eq("user_id", ctx.appUserId)
    .eq("tenant_id", ctx.tenant.id);

  const issueIds = (watcherRows ?? []).map((r) => r.issue_id);

  let issues: WatchedIssue[] = [];
  if (issueIds.length > 0) {
    const { data } = await supabase
      .from("issues")
      .select("id, number, title, status, priority, type, assignee_id, created_at, updated_at, project:project_id(key, name)")
      .in("id", issueIds)
      .eq("tenant_id", ctx.tenant.id)
      .order("updated_at", { ascending: false });
    issues = (data ?? []) as unknown as WatchedIssue[];
  }

  // Fetch assignee names
  const assigneeIds = [...new Set(issues.map((i) => i.assignee_id).filter(Boolean))] as string[];
  const memberMap: Record<string, string> = {};
  if (assigneeIds.length > 0) {
    const svc = createSupabaseServiceClient();
    const { data: members } = await svc
      .from("users")
      .select("id, full_name, email")
      .in("id", assigneeIds);
    for (const m of members ?? []) {
      memberMap[m.id] = m.full_name || m.email || "Unknown";
    }
  }

  // Group by status order
  const grouped = new Map<string, WatchedIssue[]>();
  for (const s of STATUS_ORDER) grouped.set(s, []);
  for (const issue of issues) {
    const key = STATUS_ORDER.includes(issue.status) ? issue.status : "todo";
    grouped.get(key)!.push(issue);
  }

  return (
    <main className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Watching</h1>
        <p className="mt-1 text-sm text-neutral-500">Issues you&apos;re subscribed to.</p>
      </div>

      {issues.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-6 py-16 text-center">
          <p className="text-sm text-neutral-500">
            You&apos;re not watching any issues yet. Open an issue and click Watch to subscribe.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {STATUS_ORDER.map((status) => {
            const group = grouped.get(status) ?? [];
            if (group.length === 0) return null;
            return (
              <section key={status}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  {statusLabel(status)} ({group.length})
                </h2>
                <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
                  {group.map((issue) => (
                    <div key={issue.id} className="flex items-start gap-3 px-4 py-3 hover:bg-neutral-50">
                      <span className="mt-0.5 shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-xs font-mono font-medium text-neutral-600">
                        {issue.project?.key ?? "?"}-{issue.number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/${slug}/issues/${issue.id}`}
                          className="block truncate text-sm font-medium text-neutral-800 hover:text-neutral-900 hover:underline"
                        >
                          {issue.title}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[issue.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                            {statusLabel(issue.status)}
                          </span>
                          {issue.priority && (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_COLORS[issue.priority] ?? "bg-neutral-100 text-neutral-600"}`}>
                              {issue.priority}
                            </span>
                          )}
                          {issue.assignee_id && (
                            <span className="text-neutral-400">{memberMap[issue.assignee_id] ?? "Unknown"}</span>
                          )}
                          <span className="text-neutral-300">·</span>
                          <span>{relativeTime(issue.updated_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
