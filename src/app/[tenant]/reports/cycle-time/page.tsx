import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
import { loadTenantFlags } from "@/lib/services/featureFlags";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import CycleTimeClient from "./CycleTimeClient";
import Link from "next/link";

export default async function CycleTimePage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ project?: string; from?: string; to?: string }>;
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
        <div className="mb-6 flex items-center gap-2 text-sm text-neutral-500">
          <Link href={`/${slug}/reports`} className="hover:text-indigo-600 transition-colors">Reports</Link>
          <span>/</span>
          <span className="font-medium text-neutral-800">Cycle Time</span>
        </div>
        <div className="max-w-lg mx-auto mt-24 text-center">
          <div className="text-4xl mb-4">📊</div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 mb-4">PRO</div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Cycle Time Analysis</h2>
          <p className="text-neutral-500 text-sm mb-6">See how long issues take from creation to resolution — with P50/P90 breakdowns by priority, type, and team member. Upgrade to Advanced Reports to unlock.</p>
          <a href={`/${slug}/admin/billing`} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">Upgrade to Pro →</a>
        </div>
      </main>
    );
  }

  const svc = createSupabaseServiceClient();
  const projectRes = await svc.from("projects").select("id, name").eq("tenant_id", ctx.tenant.id).not("status", "eq", "archived").order("name");
  const projects = (projectRes.data ?? []) as { id: string; name: string }[];

  const now = new Date();
  const defaultFrom = new Date(now); defaultFrom.setDate(defaultFrom.getDate() - 90);
  return (
    <main className="w-full px-6 py-8">
      <CycleTimeClient
        slug={slug}
        projects={projects}
        initialProjectId={sp.project ?? ""}
        initialFrom={sp.from ?? defaultFrom.toISOString().slice(0, 10)}
        initialTo={sp.to ?? now.toISOString().slice(0, 10)}
      />
    </main>
  );
}
