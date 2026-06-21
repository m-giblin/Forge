import Link from "next/link";
import { listTenants } from "@/lib/services/platform";
import { listPlatformAudit } from "@/lib/services/audit";
// eslint-disable-next-line no-restricted-imports -- admin/super-admin: service-role required, explicit tenant scoping applied (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default async function PlatformHealthPage() {
  const svc = createSupabaseServiceClient();

  const [tenants, auditEntries, openTickets] = await Promise.all([
    listTenants(),
    listPlatformAudit(),
    svc
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .then((r) => r.count ?? 0),
  ]);

  const totalWorkspaces = tenants.length;
  const totalUsers = tenants.reduce((s, t) => s + t.member_count, 0);
  const totalIssues = tenants.reduce((s, t) => s + t.issue_count, 0);
  const activeCount = tenants.filter((t) => t.status === "active").length;
  const suspendedCount = tenants.filter((t) => t.status === "suspended").length;

  const recentAudit = auditEntries.slice(0, 10);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Platform Health</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Real-time overview of all workspaces, support load, and recent activity.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Workspaces" value={totalWorkspaces} sub={`${activeCount} active · ${suspendedCount} suspended`} />
        <KpiCard label="Total Users" value={totalUsers} />
        <KpiCard label="Open Support Tickets" value={openTickets as number} alert={(openTickets as number) > 0} />
        <KpiCard label="Total Issues" value={totalIssues} />
      </div>

      {/* Tenant health grid */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">Tenant Health</h2>
        {tenants.length === 0 ? (
          <p className="text-sm text-neutral-500">No workspaces yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {tenants.map((t) => {
              const needsAttention = t.member_count === 0 || t.issue_count === 0;
              return (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">{t.name}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                          t.status === "active"
                            ? "bg-green-500/15 text-green-300"
                            : "bg-red-500/15 text-red-300"
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-neutral-500">/{t.slug}</div>
                    <div className="mt-1.5 flex gap-3 text-xs text-neutral-400">
                      <span>{t.member_count} member{t.member_count !== 1 ? "s" : ""}</span>
                      <span>{t.issue_count} issue{t.issue_count !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {needsAttention ? (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
                        Needs attention
                      </span>
                    ) : (
                      <span className="text-emerald-400 text-xs">● Healthy</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent activity + quick actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Activity feed */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">Recent Activity</h2>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800">
            {recentAudit.length === 0 ? (
              <p className="px-4 py-6 text-sm text-neutral-500 text-center">No audit events yet.</p>
            ) : (
              recentAudit.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-neutral-600 mt-2" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-neutral-200">
                      <span className="font-medium">{entry.actor ?? "system"}</span>{" "}
                      <span className="text-neutral-400">{entry.action}</span>
                      {entry.target && (
                        <span className="ml-1 font-mono text-xs text-neutral-500">→ {entry.target}</span>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-neutral-600">{timeAgo(entry.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Quick actions */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">Quick Actions</h2>
          <div className="space-y-2">
            <QuickAction href="/admin/tenants" label="Provision workspace" desc="Add a new tenant to the platform" />
            <QuickAction href="/admin/support" label="View support queue" desc={`${openTickets} open ticket${(openTickets as number) !== 1 ? "s" : ""}`} alert={(openTickets as number) > 0} />
            <QuickAction href="/admin/flags" label="Manage flags" desc="Toggle features globally or per tenant" />
            <QuickAction href="/admin/compliance" label="Compliance requests" desc="GDPR, CCPA, and data governance" />
          </div>
        </section>
      </div>
    </main>
  );
}

function KpiCard({ label, value, sub, alert }: { label: string; value: number; sub?: string; alert?: boolean }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${alert ? "text-red-400" : "text-white"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

function QuickAction({ href, label, desc, alert }: { href: string; label: string; desc?: string; alert?: boolean }) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 hover:bg-neutral-800 transition-colors"
    >
      <p className={`text-sm font-medium ${alert ? "text-red-300" : "text-white"}`}>{label}</p>
      {desc && <p className="mt-0.5 text-xs text-neutral-500">{desc}</p>}
    </Link>
  );
}
