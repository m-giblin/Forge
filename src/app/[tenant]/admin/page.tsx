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

function ragStatus(blocked: number, inReview: number, total: number): "on_track" | "at_risk" | "blocked" {
  if (blocked > 0) return "blocked";
  if (total > 0 && inReview / total > 0.4) return "at_risk";
  return "on_track";
}

function RagBadge({ status }: { status: "on_track" | "at_risk" | "blocked" }) {
  if (status === "blocked")
    return <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">● Blocked</span>;
  if (status === "at_risk")
    return <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-600">● At Risk</span>;
  return <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-600">● On Track</span>;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Workspace Overview</h1>
          <p className="text-sm text-neutral-500">{ctx.tenant.name} · admin dashboard</p>
        </div>
      </div>

      {/* Proactive AI intelligence widgets — always visible, no button click needed */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BoardHealthWidget digest={boardHealth} slug={slug} />
        <StandupWidget digest={standupDigest} slug={slug} />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Active Projects", value: projects.length, sub: `${projectHealth.filter(p => p.rag === "on_track").length} on track`, color: "text-indigo-600" },
          { label: "Team Members", value: members.length, sub: "in this workspace", color: "text-neutral-900" },
          { label: "Open Issues", value: openIssues, sub: "across all projects", color: "text-neutral-900" },
          { label: "Unassigned", value: unassigned, sub: "need an owner", color: unassigned > 0 ? "text-red-600" : "text-neutral-900" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-sm text-neutral-500">{kpi.label}</p>
            <p className={`mt-1 text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="mt-0.5 text-xs text-neutral-400">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Project health cards */}
      {projectHealth.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-700">Project Health</h2>
            <Link href={`/${slug}/projects`} className="text-xs text-indigo-600 hover:underline">All projects →</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {projectHealth.map((p) => (
              <Link
                key={p.id}
                href={`/${slug}/projects/${p.key}`}
                className="rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{p.key}</p>
                    <p className="truncate font-semibold text-neutral-900">{p.name}</p>
                  </div>
                  <RagBadge status={p.rag} />
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className={`h-full rounded-full transition-all ${p.rag === "blocked" ? "bg-red-500" : p.rag === "at_risk" ? "bg-amber-500" : "bg-green-500"}`}
                    style={{ width: `${p.pct}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                  <span>{p.open} open · {p.done} done</span>
                  <span className="font-medium">{p.pct}% complete</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${slug}/admin/members`} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">👥 Manage members</Link>
          <Link href={`/${slug}/admin/api-keys`} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">🔑 API keys</Link>
          <Link href={`/${slug}/admin/fields`} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">🏷 Fields & categories</Link>
          <Link href={`/${slug}/admin/activity`} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">📜 Audit log</Link>
        </div>
      </div>
    </div>
  );
}
