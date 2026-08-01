import { redirect } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role required: cross-project rollup, not scoped to caller's own projects (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import PageHeader from "@/components/patterns/PageHeader";

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

function health(blocked: number): { label: string; fg: string; bg: string } {
  if (blocked > 2) return { label: "At risk", fg: "#c0392b", bg: "#fbeae8" };
  if (blocked > 0) return { label: "Needs attention", fg: "#c9791d", bg: "#fdf1de" };
  return { label: "Healthy", fg: "#3f7d4c", bg: "#e9f3ea" };
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
    <main className="flex h-[calc(100vh-56px)] flex-col overflow-hidden md:h-screen">
      <PageHeader title="Portfolio" subtitle="Every project's health and epic progress, in one view" />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-[18px] pb-7">
        {rows.length === 0 ? (
          <div className="fw-card px-6 py-16 text-center text-[13px] text-[#726e60]">No active projects yet.</div>
        ) : (
          <div className="flex max-w-[1100px] flex-col gap-3">
            {rows.map((p) => {
              const h = health(p.blocked);
              return (
                <Link key={p.id} href={`/${slug}/projects/${p.key}`} className="fw-card block p-4 sm:px-[18px] sm:py-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="rounded bg-[#eae6da] px-[7px] py-[3px] font-mono text-[11px] font-bold text-[#726e60]">{p.key}</span>
                    <span className="text-[14px] font-bold text-[#20201d]">{p.name}</span>
                    <div className="flex-1" />
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{ color: h.fg, backgroundColor: h.bg }}
                    >
                      {h.label}
                    </span>
                    <span className="text-[11.5px] text-[#726e60]">
                      {p.total} issues · {p.done} done · {p.blocked} blocked · {p.members} member{p.members === 1 ? "" : "s"}
                    </span>
                  </div>

                  {p.epics.length > 0 && (
                    <div className="mt-[13px] flex flex-wrap gap-2 border-t border-[#e3ded0] pt-[13px]">
                      {p.epics.map((e) => {
                        const pct = e.total > 0 ? Math.round((e.done / e.total) * 100) : 0;
                        return (
                          <div key={e.id} className="flex items-center gap-[7px] rounded-full bg-[#eae6da] px-2.5 py-1">
                            <span className="max-w-[150px] truncate text-[11px] text-[#4a473e]">{e.title}</span>
                            <div className="h-1 w-11 overflow-hidden rounded-full bg-[#e3ded0]">
                              <div className="h-full rounded-full bg-[#8c4632]" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10.5px] font-bold text-[#a19d90]">{pct}%</span>
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
      </div>
    </main>
  );
}
