import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
import { loadTenantFlags } from "@/lib/services/featureFlags";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import ControlChartClient from "./ControlChartClient";
import Link from "next/link";

export default async function ControlChartPage({
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
        <div className="max-w-lg mx-auto mt-24 text-center">
          <div className="text-4xl mb-4">📉</div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 mb-4">PRO</div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Control Chart</h2>
          <p className="text-neutral-500 text-sm mb-6">See every completed issue&apos;s cycle time plotted over the date it finished, with median and P90 reference lines — spot which issues broke from the normal pattern. Upgrade to Advanced Reports to unlock.</p>
          <Link href={`/${slug}/billing`} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">Upgrade to Pro →</Link>
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
      <ControlChartClient
        slug={slug}
        projects={projects}
        initialProjectId={sp.project ?? ""}
        initialFrom={sp.from ?? defaultFrom.toISOString().slice(0, 10)}
        initialTo={sp.to ?? now.toISOString().slice(0, 10)}
      />
    </main>
  );
}
