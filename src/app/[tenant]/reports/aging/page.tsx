import { redirect } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
import { loadTenantFlags } from "@/lib/services/featureFlags";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import AgingClient from "./AgingClient";

export default async function AgingPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ project?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (!ctxCanDo(ctx, "view_reports")) redirect(`/${slug}/board`);

  const flags = await loadTenantFlags(ctx.tenant.id);
  if (!flags.advanced_reports) {
    return (
      <main className="w-full px-6 py-8">
        <div className="max-w-lg mx-auto mt-24 text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 mb-4">PRO</div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Issue Aging Report</h2>
          <p className="text-neutral-500 text-sm mb-6">Surface open issues by age — identify stale work before it becomes a stakeholder risk. Shows age buckets, priority breakdown, and the oldest open items.</p>
          <a href={`/${slug}/admin/billing`} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">Upgrade to Pro →</a>
        </div>
      </main>
    );
  }

  const svc = createSupabaseServiceClient();
  const projectRes = await svc.from("projects").select("id, name").eq("tenant_id", ctx.tenant.id).not("status", "eq", "archived").order("name");
  const projects = (projectRes.data ?? []) as { id: string; name: string }[];

  return (
    <main className="w-full px-6 py-8">
      <AgingClient slug={slug} projects={projects} initialProjectId={sp.project ?? ""} />
    </main>
  );
}
