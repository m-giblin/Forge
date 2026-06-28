import { redirect } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
import { loadTenantFlags } from "@/lib/services/featureFlags";
import ScheduledClient from "./ScheduledClient";

export default async function ScheduledPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
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
          <span className="font-medium text-neutral-800">Scheduled Reports</span>
        </div>
        <div className="max-w-lg mx-auto mt-24 text-center">
          <div className="text-4xl mb-4">📬</div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 mb-4">PRO</div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Scheduled Reports</h2>
          <p className="text-neutral-500 text-sm mb-6">Automatically email reports to stakeholders on your schedule — daily, weekly, or monthly. Set it once, show up every board meeting prepared.</p>
          <a href={`/${slug}/admin/billing`} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">Upgrade to Pro →</a>
        </div>
      </main>
    );
  }

  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  return (
    <main className="w-full px-6 py-8">
      <ScheduledClient slug={slug} isAdmin={isAdmin} />
    </main>
  );
}
