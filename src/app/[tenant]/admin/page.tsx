import { redirect } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required, tenant context verified by getTenantContext (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { projectsRepo } from "@/lib/repositories/projects";
import { membersRepo } from "@/lib/repositories/members";
import { issuesRepo } from "@/lib/repositories/issues";
import { getLatestBoardHealth } from "@/lib/services/boardMonitor";
import { getLatestStandupDigest } from "@/lib/services/standupDigest";
import BoardHealthWidget from "./BoardHealthWidget";
import StandupWidget from "./StandupWidget";
import PageHeader from "@/components/patterns/PageHeader";
import StatsRow from "@/components/patterns/admin/StatsRow";

function ragStatus(blocked: number, inReview: number, total: number): "on_track" | "at_risk" | "blocked" {
  if (blocked > 0) return "blocked";
  if (total > 0 && inReview / total > 0.4) return "at_risk";
  return "on_track";
}

const RAG_TOOLTIP = {
  blocked: "Blocked: one or more issues in this project have status 'blocked'. Needs immediate attention.",
  at_risk: "At Risk: more than 40% of open issues are stuck in review. Throughput may be stalled.",
  on_track: "On Track: no blocked issues and review queue is healthy (<40% in review).",
};

function RagBadge({ status }: { status: "on_track" | "at_risk" | "blocked" }) {
  if (status === "blocked")
    return <span title={RAG_TOOLTIP.blocked} className="cursor-help rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">● Blocked ⓘ</span>;
  if (status === "at_risk")
    return <span title={RAG_TOOLTIP.at_risk} className="cursor-help rounded-full border border-[#f3ddb4] bg-[#fdf1de] px-2.5 py-0.5 text-xs font-semibold text-[#c9791d]">● At Risk ⓘ</span>;
  return <span title={RAG_TOOLTIP.on_track} className="cursor-help rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-600">● On Track ⓘ</span>;
}

export default async function AdminOverviewPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const svc = createSupabaseServiceClient();
  const pRepo = projectsRepo(svc);
  const mRepo = membersRepo(svc);
  const iRepo = issuesRepo(svc);

  const [projects, members, unassigned, allIssues, boardHealth, standupDigest] = await Promise.all([
    pRepo.listByTenant(ctx.tenant.id, ["active", "on_hold"]),
    mRepo.list(ctx.tenant.id),
    iRepo.countUnassigned(ctx.tenant.id),
    iRepo.listByTenant(ctx.tenant.id),
    getLatestBoardHealth(ctx.tenant.id),
    getLatestStandupDigest(ctx.tenant.id),
  ]);

  const openIssues = allIssues.filter((i) => i.status !== "done" && i.status !== "closed").length;

  const projectHealth = projects.map((p) => {
    const pIssues = allIssues.filter((i) => i.project_id === p.id);
    const open = pIssues.filter((i) => i.status !== "done").length;
    const done = pIssues.filter((i) => i.status === "done").length;
    const blocked = pIssues.filter((i) => i.status === "blocked").length;
    const inReview = pIssues.filter((i) => i.status === "in_review").length;
    const pct = pIssues.length > 0 ? Math.round((done / pIssues.length) * 100) : 0;
    return { ...p, open, done, blocked, inReview, total: pIssues.length, pct, rag: ragStatus(blocked, inReview, pIssues.length) };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Workspace Overview" subtitle={`${ctx.tenant.name} · admin dashboard`} />

      <div className="space-y-6 px-6">
        {/* Proactive AI intelligence widgets — always visible, no button click needed */}
        <div className="grid gap-4 lg:grid-cols-2">
          <BoardHealthWidget digest={boardHealth} slug={slug} />
          <StandupWidget digest={standupDigest} slug={slug} />
        </div>

        {/* KPI strip */}
        <StatsRow
          items={[
            { label: "Active Projects", value: projects.length, hint: `${projectHealth.filter((p) => p.rag === "on_track").length} on track` },
            { label: "Team Members", value: members.length, hint: "in this workspace" },
            { label: "Open Issues", value: openIssues, hint: "across all projects" },
            { label: "Unassigned", value: unassigned, hint: unassigned > 0 ? "need an owner" : "all assigned" },
          ]}
        />

        {/* Project health cards */}
        {projectHealth.length > 0 && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[12.5px] font-bold text-[#20201d]">Project Health</h2>
              <Link href={`/${slug}/projects`} className="text-[11.5px] font-semibold text-[#b7452f] hover:underline">All projects →</Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {projectHealth.map((p) => (
                <Link
                  key={p.id}
                  href={`/${slug}/projects/${p.key}`}
                  className="fw-card block p-3.5 transition hover:border-[#b7452f]/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-bold uppercase tracking-wide text-[#a19d90]">{p.key}</p>
                      <p className="truncate text-[13px] font-semibold text-[#20201d]">{p.name}</p>
                    </div>
                    <RagBadge status={p.rag} />
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#e3ded0]">
                    <div
                      className={`h-full rounded-full transition-all ${p.rag === "blocked" ? "bg-[#c0392b]" : p.rag === "at_risk" ? "bg-[#c9791d]" : "bg-[#4b7a4f]"}`}
                      style={{ width: `${p.pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-[#726e60]">
                    <span>{p.open} open · {p.done} done</span>
                    <span className="font-semibold">{p.pct}% complete</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div>
          <h2 className="mb-3 text-[12.5px] font-bold text-[#20201d]">Quick Actions</h2>
          <div className="flex flex-wrap gap-2">
            <Link href={`/${slug}/admin/members`} className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-1.5 text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#ede9db]">👥 Manage members</Link>
            <Link href={`/${slug}/admin/api-keys`} className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-1.5 text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#ede9db]">🔑 API keys</Link>
            <Link href={`/${slug}/admin/fields`} className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-1.5 text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#ede9db]">🏷 Fields & categories</Link>
            <Link href={`/${slug}/admin/activity`} className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-1.5 text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#ede9db]">📜 Audit log</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
