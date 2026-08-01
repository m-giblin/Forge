import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role required: cross-project queue, not scoped to caller's own issues (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import PageHeader from "@/components/patterns/PageHeader";
import SectionGroup from "@/components/patterns/SectionGroup";

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

// Ember Rust status colors (HANDOFF.md §3). The prototype's PR states are
// open/draft/merged; real pr_state data is open/closed/merged, so "closed"
// reuses the neutral (draft) color — no new hex was invented for it.
const STATE_CHIP: Record<string, { label: string; fg: string; bg: string }> = {
  open: { label: "Open", fg: "#3f7d4c", bg: "#e9f3ea" },
  merged: { label: "Merged", fg: "#7a4fa0", bg: "#f4ecfa" },
  closed: { label: "Closed", fg: "#a19d90", bg: "#f1efe9" },
};

function PrSection({
  label,
  color,
  rows,
  slug,
  emptyLabel,
}: {
  label: string;
  color: string;
  rows: PrRow[];
  slug: string;
  emptyLabel: string;
}) {
  return (
    <SectionGroup label={label} color={color} count={rows.length}>
      {rows.length === 0 ? (
        <div className="p-[22px] text-center text-[12px] text-[#c3bda9]">{emptyLabel}</div>
      ) : (
        rows.map((r, i) => {
          const state = STATE_CHIP[r.prState] ?? STATE_CHIP.open;
          return (
            // Whole-row link (matches the pre-restyle behavior) — hand-rolled
            // rather than the ListRow pattern component, since ListRow's
            // click target is a button/div, not an anchor spanning the row.
            <a
              key={r.id}
              href={`/${slug}/issues/${r.issueId}`}
              className={`flex w-full items-center gap-3 px-3.5 py-[11px] transition-colors hover:bg-[#eae6da]/50 ${i === 0 ? "" : "border-t border-[#e3ded0]"}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-[#20201d]">{r.prTitle ?? r.issueTitle}</p>
                <p className="mt-0.5 font-mono text-[11px] text-[#a19d90]">
                  {r.repoFullName} #{r.prNumber}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-[#726e60]">{r.issueKey}</span>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ color: state.fg, backgroundColor: state.bg }}
              >
                {state.label}
              </span>
            </a>
          );
        })
      )}
    </SectionGroup>
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
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Code Review"
        subtitle="Pull requests linked to issues across every project"
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-[18px]">
        <div className="flex max-w-[1000px] flex-col gap-5">
          <PrSection
            label="Waiting on your review"
            color="#c9791d"
            rows={waitingOnYou}
            slug={slug}
            emptyLabel="Nothing waiting on you."
          />
          <PrSection
            label="Your open PRs"
            color="#3a6ea8"
            rows={yourOpenPrs}
            slug={slug}
            emptyLabel="You have no open PRs."
          />
          <PrSection
            label="Recently merged"
            color="#7a4fa0"
            rows={recentlyMerged}
            slug={slug}
            emptyLabel="Nothing merged recently."
          />
        </div>
      </div>
    </div>
  );
}
