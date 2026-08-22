import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: cross-project issue read for current user (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { projectsRepo } from "@/lib/repositories/projects";
import SectionGroup from "@/components/patterns/SectionGroup";
import MyDayIssueRow, { type FocusIssue } from "./MyDayIssueRow";

function FocusSection({ title, items, color, slug }: { title: string; items: FocusIssue[]; color: string; slug: string }) {
  if (items.length === 0) return null;
  return (
    <SectionGroup label={title} color={color} count={items.length} collapsible>
      {items.map((i, idx) => (
        <MyDayIssueRow key={i.id} issue={i} slug={slug} first={idx === 0} />
      ))}
    </SectionGroup>
  );
}

export default async function MyTodayPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);

  const svc = createSupabaseServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // FORGE-190: closed/archived projects shouldn't keep nagging their assignees.
  const activeProjectIds = await projectsRepo(svc).listActiveIds(ctx.tenant.id);

  // All issues assigned to me that are not done/closed/archived
  const { data: rows } = await svc
    .from("issues")
    .select("id, number, title, status, priority, due_date, project_id, sprint_id")
    .eq("tenant_id", ctx.tenant.id)
    .eq("assignee_id", ctx.appUserId)
    .not("status", "in", '("done","closed","archived")')
    .in("project_id", activeProjectIds)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(100);

  if (!rows || rows.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-6 py-12">
        <h1 className="font-[family-name:var(--font-manrope)] text-[21px] font-extrabold text-[#20201d]">My Day</h1>
        <p className="mt-2 text-[12.5px] text-[#726e60]">Nothing assigned to you right now. Enjoy the quiet.</p>
      </main>
    );
  }

  // Enrich with project key + sprint name
  const projectIds = [...new Set(rows.map((r) => r.project_id as string))];
  const sprintIds = [...new Set(rows.map((r) => r.sprint_id as string).filter(Boolean))];

  const [projRes, sprintRes] = await Promise.all([
    svc.from("projects").select("id, key").in("id", projectIds),
    sprintIds.length
      ? svc.from("sprints").select("id, name").in("id", sprintIds)
      : Promise.resolve({ data: [] }),
  ]);

  const projMap = new Map((projRes.data ?? []).map((p) => [p.id as string, p.key as string]));
  const sprintMap = new Map((sprintRes.data ?? []).map((s) => [s.id as string, s.name as string]));

  const issues: FocusIssue[] = rows.map((r) => ({
    id: r.id as string,
    number: r.number as number,
    title: r.title as string,
    status: r.status as string,
    priority: r.priority as string,
    dueDate: r.due_date as string | null,
    projectKey: projMap.get(r.project_id as string) ?? "?",
    sprintName: r.sprint_id ? (sprintMap.get(r.sprint_id as string) ?? null) : null,
    isOverdue: !!r.due_date && (r.due_date as string) < today,
  }));

  const overdue = issues.filter((i) => i.isOverdue);
  const inProgress = issues.filter((i) => !i.isOverdue && i.status === "in_progress");
  const todo = issues.filter((i) => !i.isOverdue && i.status !== "in_progress");

  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-6 py-[22px] pb-8">
      <div className="max-w-[720px]">
        <h1 className="font-[family-name:var(--font-manrope)] text-[21px] font-extrabold text-[#20201d]">My Day</h1>
        <p className="mt-[3px] text-[12.5px] text-[#726e60]">
          {issues.length} issue{issues.length !== 1 ? "s" : ""} assigned to you ·{" "}
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>

        <div className="mt-4 rounded-[6px] border border-[#454636] px-4 py-[13px]" style={{ backgroundImage: "linear-gradient(160deg, #2a2c26, #20221d)" }}>
          <span
            className="inline-block rounded-full border px-[7px] py-[1px] text-[10px] font-extrabold"
            style={{ color: "#e29a7e", backgroundColor: "rgba(183,69,47,0.18)", borderColor: "rgba(183,69,47,0.35)" }}
          >
            AI
          </span>
          <p className="mt-1.5 text-[12px] leading-[1.5] text-[#e5e0d1]">
            {overdue.length > 0
              ? `${overdue.length} issue${overdue.length === 1 ? " is" : "s are"} overdue — tackle ${overdue.length === 1 ? "it" : "those"} first.${inProgress.length > 0 ? ` ${inProgress.length} more ${inProgress.length === 1 ? "is" : "are"} already in progress.` : ""}`
              : inProgress.length > 0
                ? `${inProgress.length} issue${inProgress.length === 1 ? " is" : "s are"} in progress. ${todo.length > 0 ? `${todo.length} more up next.` : "Nothing overdue — good pace."}`
                : `Nothing overdue and nothing in progress yet. ${todo.length} issue${todo.length === 1 ? "" : "s"} queued up for today.`}
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-5">
          <FocusSection title="Overdue" items={overdue} color="#c0392b" slug={slug} />
          <FocusSection title="In Progress" items={inProgress} color="#c9791d" slug={slug} />
          <FocusSection title="Up Next" items={todo} color="#3a6ea8" slug={slug} />
        </div>
      </div>
    </main>
  );
}
