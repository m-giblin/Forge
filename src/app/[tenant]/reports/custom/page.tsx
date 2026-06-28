import { redirect } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports -- service-role required for project list
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
  const { data: projectRows } = await svc
    .from("projects")
    .select("id, name")
    .eq("tenant_id", ctx.tenant.id)
    .not("status", "eq", "archived")
    .order("name", { ascending: true });

  const projects = (projectRows ?? []) as { id: string; name: string }[];

  return (
    <main className="w-full px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-neutral-500">
            <Link href={`/${slug}/reports`} className="hover:text-indigo-600 transition-colors">
              Reports
            </Link>
            <span>/</span>
            <span className="text-neutral-800 font-medium">Custom Builder</span>
          </div>
          <h1 className="text-xl font-bold text-neutral-900">Custom Report Builder</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Group issues by any dimension, filter by date and project, and visualize the breakdown.
          </p>
        </div>
      </div>

      <CustomReportClient
        slug={slug}
        projectId={sp.project ?? ""}
        projects={projects}
      />
    </main>
  );
}
