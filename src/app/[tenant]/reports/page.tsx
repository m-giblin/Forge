import { getTenantContext } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ctxCanDo } from "@/lib/rbac";
import { loadReports } from "@/lib/services/reports";
import ReportsClient from "./ReportsClient";
// eslint-disable-next-line no-restricted-imports -- service-role required for sprint list at report page level (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { TimeReportSprint } from "./timeReports";

const STATUS_ORDER = ["backlog", "todo", "in_progress", "in_review", "done"];

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ from?: string; to?: string; project?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (!ctxCanDo(ctx, "view_reports")) redirect(`/${slug}/board`);

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const from = sp.from ? new Date(sp.from) : defaultFrom;
  const to = sp.to ? new Date(sp.to) : now;
  const projectId = sp.project ?? null;

  const svc = createSupabaseServiceClient();
  const [data, sprintRows] = await Promise.all([
    loadReports(ctx.tenant.id, from, to, projectId, ctx.impersonating).catch(() => null),
    svc.from("sprints").select("id, name, status, start_date, end_date, project_id, projects!inner(key)")
      .eq("tenant_id", ctx.tenant.id).in("status", ["active", "completed"])
      .order("start_date", { ascending: false }).limit(20),
  ]);

  const sprints: TimeReportSprint[] = (sprintRows.data ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    status: s.status as string,
    startDate: s.start_date as string | null,
    endDate: s.end_date as string | null,
    projectId: s.project_id as string,
    projectKey: (s.projects as unknown as { key: string }).key,
  }));
  const activeSprint = sprints.find((s) => s.status === "active") ?? null;

  if (!data) {
    return (
      <main className="w-full px-6 py-10">
        <p className="text-neutral-500">Failed to load reports. Please try again.</p>
      </main>
    );
  }

  // Sort statuses in canonical order
  data.byStatus.sort(
    (a, b) => (STATUS_ORDER.indexOf(a.status) ?? 99) - (STATUS_ORDER.indexOf(b.status) ?? 99),
  );

  return (
    <main className="w-full px-6 py-8">
      <ReportsClient
        slug={slug}
        data={data}
        from={from.toISOString().slice(0, 10)}
        to={to.toISOString().slice(0, 10)}
        projectId={projectId ?? ""}
        initialSprints={sprints}
        activeSprint={activeSprint}
      />
    </main>
  );
}
