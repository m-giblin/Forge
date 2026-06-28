import { redirect } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports -- service-role required for project + sprint list
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import CustomReportClient from "./CustomReportClient";

export default async function CustomReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ project?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (!ctxCanDo(ctx, "view_reports")) redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();
  const [projectRows, sprintRows] = await Promise.all([
    svc.from("projects").select("id, name").eq("tenant_id", ctx.tenant.id).not("status", "eq", "archived").order("name"),
    svc.from("sprints").select("id, name, project_id").eq("tenant_id", ctx.tenant.id).in("status", ["active", "completed"]).order("start_date", { ascending: false }).limit(50),
  ]);

  const projects = (projectRows.data ?? []) as { id: string; name: string }[];
  const sprints = ((sprintRows.data ?? []) as { id: string; name: string; project_id: string }[]).map((s) => ({
    id: s.id, name: s.name, projectId: s.project_id,
  }));

  return (
    <main className="w-full px-6 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-neutral-500">
        <Link href={`/${slug}/reports`} className="hover:text-indigo-600 transition-colors">Reports</Link>
        <span>/</span>
        <span className="font-medium text-neutral-800">Custom Builder</span>
      </div>
      <CustomReportClient slug={slug} projectId={sp.project ?? ""} projects={projects} sprints={sprints} />
    </main>
  );
}
