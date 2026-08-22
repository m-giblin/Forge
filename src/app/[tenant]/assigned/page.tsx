import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { projectsRepo } from "@/lib/repositories/projects";
import PageHeader from "@/components/patterns/PageHeader";
import AssignedWorkList, { type AssignedIssue } from "./AssignedWorkList";

export default async function AssignedPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const supabase = await createSupabaseServerClient();

  const sevenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 7)).toISOString();

  // FORGE-190: closed/archived projects shouldn't keep nagging their assignees.
  const activeProjectIds = await projectsRepo(supabase).listActiveIds(ctx.tenant.id);

  const [openRes, doneRes, meRes] = await Promise.all([
    supabase
      .from("issues")
      .select("id, number, title, status, priority, type, due_date, created_at, updated_at, project:project_id(key, name)")
      .eq("assignee_id", ctx.appUserId)
      .eq("tenant_id", ctx.tenant.id)
      .neq("status", "done")
      .in("project_id", activeProjectIds)
      .order("updated_at", { ascending: false }),
    supabase
      .from("issues")
      .select("id", { count: "exact", head: true })
      .eq("assignee_id", ctx.appUserId)
      .eq("tenant_id", ctx.tenant.id)
      .eq("status", "done")
      .in("project_id", activeProjectIds)
      .gte("updated_at", sevenDaysAgo),
    supabase.from("users").select("full_name, email").eq("id", ctx.appUserId).maybeSingle(),
  ]);

  const issues = (openRes.data ?? []) as unknown as AssignedIssue[];
  const completedThisWeek = doneRes.count ?? 0;
  const assigneeLabel = meRes.data?.full_name || meRes.data?.email || ctx.email || "Me";

  const openCount = issues.filter((i) => i.status === "todo").length;
  const inProgressCount = issues.filter((i) => i.status === "in_progress").length;

  return (
    <main className="flex h-[calc(100vh-56px)] flex-col overflow-hidden md:h-screen">
      <PageHeader
        title="My Work"
        subtitle={`Everything assigned to you, across every project — ${issues.length} issue${issues.length === 1 ? "" : "s"}`}
        right={
          <div className="flex items-center gap-5">
            <div className="text-right">
              <div className="font-[family-name:var(--font-manrope)] text-[20px] font-extrabold leading-none text-[#20201d]">
                {openCount}
              </div>
              <div className="text-[10.5px] text-[#a19d90]">open</div>
            </div>
            <div className="text-right">
              <div className="font-[family-name:var(--font-manrope)] text-[20px] font-extrabold leading-none text-[#c9791d]">
                {inProgressCount}
              </div>
              <div className="text-[10.5px] text-[#a19d90]">in progress</div>
            </div>
            <div className="text-right">
              <div className="font-[family-name:var(--font-manrope)] text-[20px] font-extrabold leading-none text-[#3f7d4c]">
                {completedThisWeek}
              </div>
              <div className="text-[10.5px] text-[#a19d90]">done this week</div>
            </div>
          </div>
        }
      />

      <AssignedWorkList slug={slug} issues={issues} assigneeLabel={assigneeLabel} assigneeId={ctx.appUserId} />
    </main>
  );
}
