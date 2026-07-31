import { redirect } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role required: cross-project rollup, not scoped to caller's own projects (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type EpicProgress = { id: string; title: string; done: number; total: number };
type ProjectRow = {
  id: string;
  key: string;
  name: string;
  total: number;
  done: number;
  blocked: number;
  members: number;
  epics: EpicProgress[];
};

function health(blocked: number): { label: string; dot: string; text: string } {
  if (blocked > 2) return { label: "At risk", dot: "bg-red-500", text: "text-red-700" };
  if (blocked > 0) return { label: "Needs attention", dot: "bg-amber-500", text: "text-amber-700" };
  return { label: "Healthy", dot: "bg-emerald-500", text: "text-emerald-700" };
}

export default async function PortfolioPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const svc = createSupabaseServiceClient();

  const { data: projectRows } = await svc
    .from("projects")
    .select("id, key, name")
    .eq("tenant_id", ctx.tenant.id)
    .eq("is_system_fallback", false)
    .neq("status", "archived")
    .order("name");

  const projects = projectRows ?? [];
  const projectIds = projects.map((p) => p.id as string);

  const [epicRows, sprintRows, issueRows, memberRows] = projectIds.length
    ? await Promise.all([
        svc.from("epics").select("id, project_id, title").eq("tenant_id", ctx.tenant.id).in("project_id", projectIds),
        svc.from("sprints").select("id, project_id, epic_id").eq("tenant_id", ctx.tenant.id).in("project_id", projectIds),
        svc.from("issues").select("project_id, sprint_id, status").eq("tenant_id", ctx.tenant.id).in("project_id", projectIds),
        svc.from("project_members").select("project_id").eq("tenant_id", ctx.tenant.id).in("project_id", projectIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const issues = issueRows.data ?? [];
  const sprints = sprintRows.data ?? [];
  const epics = epicRows.data ?? [];
  const members = memberRows.data ?? [];

  const rows: ProjectRow[] = projects.map((p) => {
    const pid = p.id as string;
    const projIssues = issues.filter((i) => i.project_id === pid);
    const projSprints = sprints.filter((s) => s.project_id === pid);
    const projEpics = epics.filter((e) => e.project_id === pid);

    const epicProgress: EpicProgress[] = projEpics.map((e) => {
      const sprintIds = new Set(projSprints.filter((s) => s.epic_id === e.id).map((s) => s.id));
      const epicIssues = projIssues.filter((i) => i.sprint_id && sprintIds.has(i.sprint_id));
      return {
        id: e.id as string,
        title: e.title as string,
        done: epicIssues.filter((i) => i.status === "done").length,
        total: epicIssues.length,
      };
    });

    return {
      id: pid,
      key: p.key as string,
      name: p.name as string,
      total: projIssues.length,
      done: projIssues.filter((i) => i.status === "done").length,
      blocked: projIssues.filter((i) => i.status === "blocked").length,
      members: members.filter((m) => m.project_id === pid).length,
      epics: epicProgress,
    };
  });

  return (
    <main className="w-full px-3 py-4 sm:px-6 sm:py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Portfolio</h1>
        <p className="mt-1 text-sm text-neutral-500">Every project&apos;s health and epic progress, in one view.</p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center text-sm text-neutral-500">
          No active projects yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((p) => {
            const h = health(p.blocked);
            return (
              <Link
                key={p.id}
                href={`/${slug}/projects/${p.key}`}
                className="block rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs font-semibold text-neutral-600">{p.key}</span>
                    <span className="font-medium text-neutral-900">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-neutral-500">
                    <span className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${h.dot}`} />
                      <span className={`font-medium ${h.text}`}>{h.label}</span>
                    </span>
                    <span>{p.total} issues · {p.done} done · {p.blocked} blocked · {p.members} member{p.members === 1 ? "" : "s"}</span>
                  </div>
                </div>

                {p.epics.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
                    {p.epics.map((e) => {
                      const pct = e.total > 0 ? Math.round((e.done / e.total) * 100) : 0;
                      return (
                        <div key={e.id} className="flex items-center gap-1.5 rounded-full bg-neutral-50 px-2.5 py-1 text-[11px]">
                          <span className="max-w-[140px] truncate text-neutral-700">{e.title}</span>
                          <div className="h-1 w-12 overflow-hidden rounded-full bg-neutral-200">
                            <div className="h-full rounded-full bg-neutral-900" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-neutral-400">{e.done}/{e.total}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
