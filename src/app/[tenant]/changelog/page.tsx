import { notFound } from "next/navigation";
import Link from "next/link";
// eslint-disable-next-line no-restricted-imports -- public changelog: no user JWT, service-role reads tenant + done issues
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const revalidate = 3600;

const TYPE_META: Record<string, { label: string; fg: string; bg: string; icon: string }> = {
  feature: { label: "Feature",     fg: "#7a4fa0", bg: "#f4ecfa", icon: "✨" },
  bug:     { label: "Fix",         fg: "#c0392b", bg: "#fbeae8", icon: "🐛" },
  task:    { label: "Improvement", fg: "#3a6ea8", bg: "#eaf1f8", icon: "🔧" },
};

interface IssueRow {
  id: string;
  number: number;
  title: string;
  type: string;
  priority: string;
  updated_at: string;
  projects: { key: string; name: string } | null;
}

function weekOf(dateStr: string): string {
  const d = new Date(dateStr);
  // Round down to Monday
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function ChangelogPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const svc = createSupabaseServiceClient();

  const { data: tenant } = await svc
    .from("tenants")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!tenant) notFound();

  const { data } = await svc
    .from("issues")
    .select("id, number, title, type, priority, updated_at, projects(key, name)")
    .eq("tenant_id", tenant.id)
    .eq("status", "done")
    .order("updated_at", { ascending: false })
    .limit(200);

  const issues = (data ?? []) as unknown as IssueRow[];

  // Group by week
  const weeks = new Map<string, IssueRow[]>();
  for (const issue of issues) {
    const w = weekOf(issue.updated_at);
    if (!weeks.has(w)) weeks.set(w, []);
    weeks.get(w)!.push(issue);
  }

  return (
    <div className="min-h-screen bg-[#eeece4]">
      <div className="mx-auto max-w-[760px] px-6 py-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <p className="text-4xl mb-3">📋</p>
          <h1 className="font-[family-name:var(--font-manrope)] text-[21px] font-extrabold text-[#20201d]">
            {tenant.name} Changelog
          </h1>
          <p className="mt-2 text-[12.5px] text-[#726e60]">What shipped, written for customers</p>
          <div className="mt-4 flex justify-center gap-4 text-[11.5px] text-[#a19d90]">
            <span>{issues.length} issues shipped</span>
            <span>·</span>
            <span>{weeks.size} weeks</span>
          </div>
        </div>

        {issues.length === 0 ? (
          <div className="fw-card py-16 text-center text-[#a19d90]">
            <p className="text-5xl mb-3">🚀</p>
            <p className="font-bold text-[#4a473e]">Nothing shipped yet</p>
            <p className="text-[12.5px] mt-1">Issues moved to &apos;Done&apos; will appear here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-[22px]">
            {Array.from(weeks.entries()).map(([week, weekIssues]) => {
              const features = weekIssues.filter(i => i.type === "feature");
              const bugs = weekIssues.filter(i => i.type === "bug");
              const tasks = weekIssues.filter(i => !["feature","bug"].includes(i.type));

              return (
                <div key={week}>
                  {/* Week header */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-px flex-1 bg-[#ddd8c9]" />
                    <span className="text-[11.5px] font-bold text-[#726e60] whitespace-nowrap">Week of {week}</span>
                    <div className="h-px flex-1 bg-[#ddd8c9]" />
                  </div>

                  {/* Summary chips */}
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {features.length > 0 && (
                      <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: TYPE_META.feature.fg, backgroundColor: TYPE_META.feature.bg }}>
                        ✨ {features.length} feature{features.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {bugs.length > 0 && (
                      <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: TYPE_META.bug.fg, backgroundColor: TYPE_META.bug.bg }}>
                        🐛 {bugs.length} fix{bugs.length > 1 ? "es" : ""}
                      </span>
                    )}
                    {tasks.length > 0 && (
                      <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: TYPE_META.task.fg, backgroundColor: TYPE_META.task.bg }}>
                        🔧 {tasks.length} improvement{tasks.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Issue list */}
                  <div className="flex flex-col gap-[10px]">
                    {weekIssues.map((issue) => {
                      const meta = TYPE_META[issue.type] ?? TYPE_META.task;
                      return (
                        <div key={issue.id} className="fw-card flex items-start gap-3 px-4 py-3">
                          <span className="text-lg shrink-0 mt-0.5">{meta.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-bold text-[#20201d]">{issue.title}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span
                                className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                                style={{ color: meta.fg, backgroundColor: meta.bg }}
                              >
                                {meta.label}
                              </span>
                              {issue.projects && (
                                <span className="text-[11px] text-[#a19d90] font-mono">{issue.projects.key}-{issue.number}</span>
                              )}
                              <span className="text-[11px] text-[#a19d90]">
                                {new Date(issue.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-12 border-t border-[#ddd8c9] pt-6 text-center">
          <Link href={`/${slug}/board`} className="text-[12.5px] text-[#8c4632] hover:underline">← Back to board</Link>
        </div>
      </div>
    </div>
  );
}
