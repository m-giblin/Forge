import { getTenantContext } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loadReports } from "@/lib/services/reports";
import ReportsClient from "./ReportsClient";

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

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const from = sp.from ? new Date(sp.from) : defaultFrom;
  const to = sp.to ? new Date(sp.to) : now;
  const projectId = sp.project ?? null;

  const data = await loadReports(ctx.tenant.id, from, to, projectId, ctx.impersonating).catch(() => null);

  if (!data) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-10">
        <p className="text-neutral-500">Failed to load reports. Please try again.</p>
      </main>
    );
  }

  // Sort statuses in canonical order
  data.byStatus.sort(
    (a, b) => (STATUS_ORDER.indexOf(a.status) ?? 99) - (STATUS_ORDER.indexOf(b.status) ?? 99),
  );

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <ReportsClient
        slug={slug}
        data={data}
        from={from.toISOString().slice(0, 10)}
        to={to.toISOString().slice(0, 10)}
        projectId={projectId ?? ""}
      />
    </main>
  );
}
