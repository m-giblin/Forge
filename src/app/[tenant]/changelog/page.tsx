import { notFound } from "next/navigation";
import Link from "next/link";
// eslint-disable-next-line no-restricted-imports -- public changelog: no user JWT, service-role reads tenant + done issues
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const revalidate = 3600;

const TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  feature: { label: "New",         color: "bg-green-50 text-green-700 border-green-200",  icon: "✨" },
  bug:     { label: "Fixed",       color: "bg-red-50 text-red-700 border-red-200",         icon: "🐛" },
  task:    { label: "Improved",    color: "bg-blue-50 text-blue-700 border-blue-200",       icon: "🔧" },
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
    <div className="mx-auto max-w-3xl px-6 py-12">
      {/* Header */}
      <div className="mb-10 text-center">
        <p className="text-4xl mb-3">📋</p>
        <h1 className="text-3xl font-bold text-neutral-900">{tenant.name} Changelog</h1>
        <p className="mt-2 text-neutral-500">What we&apos;ve shipped, week by week.</p>
        <div className="mt-4 flex justify-center gap-4 text-sm text-neutral-400">
          <span>{issues.length} issues shipped</span>
          <span>·</span>
          <span>{weeks.size} weeks</span>
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <p className="text-5xl mb-3">🚀</p>
          <p className="font-medium text-neutral-600">Nothing shipped yet</p>
          <p className="text-sm mt-1">Issues moved to &apos;Done&apos; will appear here.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {Array.from(weeks.entries()).map(([week, weekIssues]) => {
            const features = weekIssues.filter(i => i.type === "feature");
            const bugs = weekIssues.filter(i => i.type === "bug");
            const tasks = weekIssues.filter(i => !["feature","bug"].includes(i.type));

            return (
              <div key={week}>
                {/* Week header */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-px flex-1 bg-neutral-200" />
                  <span className="text-sm font-semibold text-neutral-500 whitespace-nowrap">Week of {week}</span>
                  <div className="h-px flex-1 bg-neutral-200" />
                </div>

                {/* Summary chips */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  {features.length > 0 && <span className="rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-xs font-medium text-green-700">✨ {features.length} feature{features.length > 1 ? "s" : ""}</span>}
                  {bugs.length > 0 && <span className="rounded-full bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700">🐛 {bugs.length} fix{bugs.length > 1 ? "es" : ""}</span>}
                  {tasks.length > 0 && <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700">🔧 {tasks.length} improvement{tasks.length > 1 ? "s" : ""}</span>}
                </div>

                {/* Issue list */}
                <div className="space-y-2">
                  {weekIssues.map((issue) => {
                    const meta = TYPE_META[issue.type] ?? TYPE_META.task;
                    return (
                      <div key={issue.id} className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 hover:border-neutral-300 transition-colors">
                        <span className="text-lg shrink-0 mt-0.5">{meta.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-neutral-900">{issue.title}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>{meta.label}</span>
                            {issue.projects && (
                              <span className="text-[10px] text-neutral-400 font-mono">{issue.projects.key}-{issue.number}</span>
                            )}
                            <span className="text-[10px] text-neutral-400">
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

      <div className="mt-12 border-t border-neutral-100 pt-6 text-center">
        <Link href={`/${slug}/board`} className="text-sm text-indigo-600 hover:underline">← Back to board</Link>
      </div>
    </div>
  );
}
