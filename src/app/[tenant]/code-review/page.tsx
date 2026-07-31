import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role required: cross-project queue, not scoped to caller's own issues (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type PrRow = {
  id: string;
  issueId: string;
  issueKey: string;
  issueTitle: string;
  repoFullName: string;
  prNumber: number;
  prState: string;
  prTitle: string | null;
  prUrl: string | null;
  assigneeId: string | null;
};

const STATE_BADGE: Record<string, { label: string; cls: string }> = {
  merged: { label: "Merged", cls: "bg-purple-100 text-purple-700" },
  open: { label: "Open", cls: "bg-green-100 text-green-700" },
  closed: { label: "Closed", cls: "bg-neutral-100 text-neutral-500" },
};

function PrList({ rows, slug, emptyLabel }: { rows: PrRow[]; slug: string; emptyLabel: string }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-8 text-center text-sm text-neutral-400">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
      {rows.map((r) => {
        const badge = STATE_BADGE[r.prState] ?? STATE_BADGE.open;
        return (
          <a
            key={r.id}
            href={`/${slug}/issues/${r.issueId}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors"
          >
            <span className="mt-0.5 shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-xs font-mono font-medium text-neutral-600">
              {r.issueKey}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-800">{r.prTitle ?? r.issueTitle}</p>
              <p className="text-xs text-neutral-400 font-mono">{r.repoFullName} #{r.prNumber}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
          </a>
        );
      })}
    </div>
  );
}

export default async function CodeReviewPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const svc = createSupabaseServiceClient();

  const { data: projectRows } = await svc
    .from("projects")
    .select("id, key")
    .eq("tenant_id", ctx.tenant.id)
    .neq("status", "archived");

  const projects = projectRows ?? [];
  const projectIds = projects.map((p) => p.id as string);
  const keyByProject = new Map(projects.map((p) => [p.id as string, p.key as string]));

  const { data: issueRows } = projectIds.length
    ? await svc
        .from("issues")
        .select("id, number, title, project_id, assignee_id")
        .eq("tenant_id", ctx.tenant.id)
        .in("project_id", projectIds)
    : { data: [] };

  const issues = issueRows ?? [];
  const issueIds = issues.map((i) => i.id as string);
  const issueById = new Map(issues.map((i) => [i.id as string, i]));

  const { data: linkRows } = issueIds.length
    ? await svc
        .from("issue_code_links")
        .select("id, issue_id, repo_full_name, pr_number, link_kind, pr_state, pr_title, pr_url, updated_at")
        .eq("tenant_id", ctx.tenant.id)
        .in("issue_id", issueIds)
        .neq("link_kind", "commit")
        .order("updated_at", { ascending: false })
    : { data: [] };

  const links = linkRows ?? [];

  const toRow = (l: (typeof links)[number]): PrRow | null => {
    const issue = issueById.get(l.issue_id as string);
    if (!issue) return null;
    const projectKey = keyByProject.get(issue.project_id as string) ?? "??";
    return {
      id: l.id as string,
      issueId: issue.id as string,
      issueKey: `${projectKey}-${issue.number}`,
      issueTitle: issue.title as string,
      repoFullName: l.repo_full_name as string,
      prNumber: l.pr_number as number,
      prState: (l.pr_state as string) ?? "open",
      prTitle: l.pr_title as string | null,
      prUrl: l.pr_url as string | null,
      assigneeId: issue.assignee_id as string | null,
    };
  };

  const allPrs = links.map(toRow).filter((r): r is PrRow => r !== null);

  const openPrs = allPrs.filter((r) => r.prState === "open");
  // Real-data proxy, matching the design's own actual behavior (it has no real
  // PR-reviewer data either — it uses the linked issue's assignee as the PR
  // owner stand-in): "waiting on your review" = every open PR NOT assigned to you.
  const waitingOnYou = openPrs.filter((r) => r.assigneeId !== ctx.appUserId);
  const yourOpenPrs = openPrs.filter((r) => r.assigneeId === ctx.appUserId);
  const recentlyMerged = allPrs.filter((r) => r.prState === "merged").slice(0, 20);

  return (
    <main className="w-full px-3 py-4 sm:px-6 sm:py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Code Review</h1>
        <p className="mt-1 text-sm text-neutral-500">Pull requests linked to issues across every project.</p>
      </div>

      <div className="flex flex-col gap-6">
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-orange-600">
            Waiting on your review <span className="font-normal text-neutral-400">({waitingOnYou.length})</span>
          </h2>
          <PrList rows={waitingOnYou} slug={slug} emptyLabel="Nothing waiting on you." />
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
            Your open PRs <span className="font-normal text-neutral-400">({yourOpenPrs.length})</span>
          </h2>
          <PrList rows={yourOpenPrs} slug={slug} emptyLabel="You have no open PRs." />
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-purple-600">
            Recently merged <span className="font-normal text-neutral-400">({recentlyMerged.length})</span>
          </h2>
          <PrList rows={recentlyMerged} slug={slug} emptyLabel="Nothing merged recently." />
        </section>
      </div>
    </main>
  );
}
