import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/auth";
import { projectWikiPagesRepo } from "@/lib/repositories/projects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- impersonation client-select: ctx.impersonating chooses service vs user JWT, all DB calls go through repos (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { loadProjectPortal, loadProjectCosts, loadProjectTimeline, type Health } from "@/lib/services/projectPortal";
import { sprintsRepo } from "@/lib/repositories/sprints";
import ProjectOverview from "./ProjectOverview";
import CostsTab from "./CostsTab";
import TimelineTab from "./TimelineTab";
import { ProjectStatusBadge, ProjectDangerZone } from "./ProjectStatusControl";
import ProjectEditPanel from "./ProjectEditPanel";
import BudgetAlertBanner from "@/components/BudgetAlertBanner";
import WhiteboardsPanel from "./WhiteboardsPanel";
import CategoryImporter from "@/app/[tenant]/admin/fields/CategoryImporter";
import { fieldConfigRepo } from "@/lib/repositories/fieldConfig";

const HEALTH_META: Record<Health, { label: string; cls: string; dot: string }> = {
  on_track: { label: "On track", cls: "bg-emerald-100 text-emerald-700", dot: "●" },
  at_risk: { label: "At risk", cls: "bg-amber-100 text-amber-700", dot: "●" },
  off_track: { label: "Off track", cls: "bg-red-100 text-red-700", dot: "●" },
  not_started: { label: "Not started", cls: "bg-neutral-100 text-neutral-500", dot: "○" },
};
const GOLIVE_CLS: Record<string, string> = {
  neutral: "bg-neutral-100 text-neutral-500",
  good: "bg-emerald-100 text-emerald-700",
  warn: "bg-amber-100 text-amber-700",
  bad: "bg-red-100 text-red-700",
};

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string; key: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tenant: slug, key } = await params;
  const { tab: tabParam } = await searchParams;
  const VALID_TABS = ["overview", "timeline", "costs", "whiteboards", "categories"] as const;
  type TabId = typeof VALID_TABS[number];
  const tab: TabId = (VALID_TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as TabId) : "overview";

  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const supabase = ctx.impersonating ? createSupabaseServiceClient() : await createSupabaseServerClient();

  const data = await loadProjectPortal({ tenantId: ctx.tenant.id, projectKey: key, impersonating: ctx.impersonating });
  if (!data) notFound();

  const svcClient = createSupabaseServiceClient();
  const [wiki, sprintVelocity, existingCategories] = await Promise.all([
    projectWikiPagesRepo(supabase).getForProject(ctx.tenant.id, data.project.id),
    sprintsRepo(svcClient).velocity(ctx.tenant.id, data.project.id).catch(() => []),
    fieldConfigRepo(svcClient).listCategories(ctx.tenant.id, data.project.id).catch(() => []),
  ]);
  const canEdit = ctx.role !== "viewer" && !ctx.impersonating;
  const isAdmin = (ctx.role === "owner" || ctx.role === "admin") && !ctx.impersonating;
  const health = HEALTH_META[data.health];
  const base = `/${slug}/projects/${data.project.key}`;

  const tabs: { id: string; label: string; href: string; active: boolean }[] = [
    { id: "overview", label: "Overview", href: base, active: tab === "overview" },
    { id: "board", label: "Board", href: `/${slug}/board?project=${data.project.key}`, active: false },
    { id: "timeline", label: "Timeline", href: `${base}?tab=timeline`, active: tab === "timeline" },
    { id: "costs", label: "Costs", href: `${base}?tab=costs`, active: tab === "costs" },
    { id: "whiteboards", label: "Whiteboards", href: `${base}?tab=whiteboards`, active: tab === "whiteboards" },
    ...(isAdmin ? [{ id: "categories", label: "Categories", href: `${base}?tab=categories`, active: tab === "categories" }] : []),
  ];

  return (
    <div className="w-full px-6 py-8">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-neutral-400">
        <Link href={`/${slug}/projects`} className="hover:text-neutral-600">Projects</Link>
        <span>/</span>
        <span className="font-mono text-neutral-500">{data.project.key}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs font-semibold text-neutral-600">{data.project.key}</span>
            <ProjectStatusBadge slug={slug} projectKey={data.project.key} status={data.project.status} isAdmin={isAdmin} />
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${health.cls}`}>{health.dot} {health.label}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${GOLIVE_CLS[data.goLive.tone]}`}>{data.goLive.label}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">{data.project.name}</h1>
          {data.project.description && (
            <p className="mt-1 text-sm text-neutral-600">{data.project.description}</p>
          )}
          <p className="mt-1 text-sm text-neutral-500">
            {data.leadName ? `Owner: ${data.leadName}` : "No owner"}
            {data.members.length > 0 && ` · ${data.members.length} member${data.members.length === 1 ? "" : "s"}`}
          </p>
          {isAdmin && (
            <div className="mt-1">
              <ProjectEditPanel
                slug={slug}
                projectKey={data.project.key}
                name={data.project.name}
                description={data.project.description ?? null}
              />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href={`/${slug}/projects/${data.project.key}/export/pdf`}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
            title="Export project status report"
          >
            📄 Export Status Report
          </a>
          <a
            href={`/${slug}/projects/${data.project.key}/export/pptx`}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 transition-colors"
            title="Export project status presentation"
          >
            📊 Export PPT
          </a>
          <Link href={`/${slug}/board?project=${data.project.key}`} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
            Open board →
          </Link>
        </div>
      </div>

      <BudgetAlertBanner projectId={data.project.id} slug={slug} projectName={data.project.name} projectKey={data.project.key} />

      {/* Archived banner */}
      {data.project.status === "archived" && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
          <span className="text-purple-500">🗄️</span>
          <p className="text-sm text-purple-800">
            This project is <strong>archived</strong> — issues are read-only. Change the status to reactivate it.
          </p>
        </div>
      )}

      {/* Tab bar */}
      <div className="mt-5 mb-5 flex gap-1 border-b border-neutral-200 overflow-x-auto">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              t.active ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "overview" && <ProjectOverview slug={slug} data={data} wiki={wiki} canEdit={canEdit} sprintVelocity={sprintVelocity} />}
      {tab === "timeline" && <TimelineTabPanel slug={slug} projectKey={data.project.key} tenantId={ctx.tenant.id} impersonating={ctx.impersonating} />}
      {tab === "costs" && <CostsTabPanel slug={slug} projectKey={data.project.key} tenantId={ctx.tenant.id} impersonating={ctx.impersonating} canEdit={canEdit} />}
      {tab === "whiteboards" && (
        <div className="px-6 py-4">
          <WhiteboardsPanel slug={slug} projectId={data.project.id} projectKey={data.project.key} canEdit={canEdit} />
        </div>
      )}

      {tab === "categories" && isAdmin && (
        <div className="max-w-2xl space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Categories for {data.project.name}</h3>
            <p className="mt-1 text-xs text-neutral-500">Upload a CSV to bulk-import categories, or manage them one by one below.</p>
          </div>
          <CategoryImporter
            slug={slug}
            projects={[{ id: data.project.id, key: data.project.key, name: data.project.name }]}
            defaultProjectId={data.project.id}
          />
          {existingCategories.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-neutral-600 mb-2">Current categories ({existingCategories.length})</p>
              <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-2">
                {existingCategories.filter((c) => !c.parent_id).map((cat) => (
                  <div key={cat.id}>
                    <p className="text-sm font-medium text-neutral-800">{cat.name}</p>
                    {existingCategories.filter((s) => s.parent_id === cat.id).map((sub) => (
                      <p key={sub.id} className="ml-4 text-xs text-neutral-500 border-l border-neutral-200 pl-2 mt-0.5">— {sub.name}</p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
          {existingCategories.length === 0 && (
            <p className="text-sm text-neutral-400">No categories yet for this project. Import a CSV to get started.</p>
          )}
        </div>
      )}

      {isAdmin && tab === "overview" && (
        <ProjectDangerZone slug={slug} projectKey={data.project.key} issueCount={data.total} />
      )}
    </div>
  );
}

async function CostsTabPanel({
  slug,
  projectKey,
  tenantId,
  impersonating,
  canEdit,
}: {
  slug: string;
  projectKey: string;
  tenantId: string;
  impersonating: boolean;
  canEdit: boolean;
}) {
  const costs = await loadProjectCosts({ tenantId, projectKey, impersonating });
  if (!costs) return null;
  return <CostsTab slug={slug} projectKey={projectKey} data={costs} canEdit={canEdit} />;
}

async function TimelineTabPanel({
  slug,
  projectKey,
  tenantId,
  impersonating,
}: {
  slug: string;
  projectKey: string;
  tenantId: string;
  impersonating: boolean;
}) {
  const timeline = await loadProjectTimeline({ tenantId, projectKey, impersonating });
  if (!timeline) return null;
  return <TimelineTab slug={slug} data={timeline} />;
}
