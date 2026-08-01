import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role required: issue_watchers RLS blocks user JWT reads
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import PageHeader from "@/components/patterns/PageHeader";
import SectionGroup from "@/components/patterns/SectionGroup";
import WatchingRow from "./WatchingRow";

// Ember Rust status colors (HANDOFF.md §3) — section dot per status group.
const STATUS_DOT: Record<string, string> = {
  backlog: "#a19d90",
  todo: "#3a6ea8",
  in_progress: "#c9791d",
  in_review: "#7a4fa0",
  blocked: "#c0392b",
  done: "#3f7d4c",
};

const PRIORITY_FG: Record<string, string> = {
  low: "#a19d90",
  medium: "#3a6ea8",
  high: "#c9791d",
  urgent: "#c0392b",
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

  // Use service client — issue_watchers RLS blocks user JWT reads
  const svcAll = createSupabaseServiceClient();

  // Get watched issue IDs
  const { data: watcherRows } = await svcAll
    .from("issue_watchers")
    .select("issue_id")
    .eq("user_id", ctx.appUserId)
    .eq("tenant_id", ctx.tenant.id);

  const issueIds = (watcherRows ?? []).map((r) => r.issue_id);

  let issues: WatchedIssue[] = [];
  if (issueIds.length > 0) {
    const { data } = await svcAll
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
    const svc = svcAll;
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
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Watching"
        subtitle={`${issues.length} issue${issues.length === 1 ? "" : "s"} you're subscribed to, across every project`}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {issues.length === 0 ? (
          <div className="fw-card p-8 text-center text-[12.5px] text-[#726e60]">
            You&apos;re not watching any issues yet. Open an issue and click Watch to subscribe.
          </div>
        ) : (
          <div className="flex max-w-[1000px] flex-col gap-5">
            {STATUS_ORDER.map((status) => {
              const group = grouped.get(status) ?? [];
              if (group.length === 0) return null;
              return (
                <SectionGroup key={status} label={statusLabel(status)} color={STATUS_DOT[status] ?? "#a19d90"} count={group.length}>
                  {group.map((issue, i) => (
                    <WatchingRow
                      key={issue.id}
                      slug={slug}
                      issueId={issue.id}
                      issueKey={`${issue.project?.key ?? "?"}-${issue.number}`}
                      title={issue.title}
                      priorityLabel={issue.priority}
                      priorityColor={issue.priority ? PRIORITY_FG[issue.priority] ?? "#a19d90" : "#a19d90"}
                      assigneeLabel={issue.assignee_id ? memberMap[issue.assignee_id] ?? "Unknown" : "Unassigned"}
                      updatedLabel={relativeTime(issue.updated_at)}
                      first={i === 0}
                    />
                  ))}
                </SectionGroup>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
