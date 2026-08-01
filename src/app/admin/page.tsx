import Link from "next/link";
import { listTenants } from "@/lib/services/platform";
import { listPlatformAudit } from "@/lib/services/audit";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { timeAgo } from "@/lib/formatRelativeTime";
import PageHeader from "@/components/patterns/PageHeader";
import StatsRow from "@/components/patterns/admin/StatsRow";
import AdminTable, { type AdminTableCell } from "@/components/patterns/admin/AdminTable";

function healthScore(t: { member_count: number; issue_count: number; status: string }) {
  let score = 0;
  if (t.status === "active") score += 25;
  if (t.member_count >= 2) score += 25;
  else if (t.member_count === 1) score += 10;
  if (t.issue_count >= 10) score += 30;
  else if (t.issue_count >= 3) score += 20;
  else if (t.issue_count >= 1) score += 10;
  if (t.member_count > 0 && t.issue_count > 0) score += 20;
  return Math.min(score, 100);
}

function healthColor(score: number) {
  return score >= 70 ? "#3f7d4c" : score >= 40 ? "#c9791d" : "#c0392b";
}

export default async function AdminDashboardPage() {
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

  const scored = tenants.map((t) => ({ ...t, health: healthScore(t) }));
  const atRisk = scored.filter((t) => t.health < 40).length;
  const recentAudit = auditEntries.slice(0, 8);
  const seatsSold = tenants.reduce((sum, t) => sum + t.member_count, 0);

  const columns = [
    { label: "Tenant", flex: true },
    { label: "Slug", width: 150 },
    { label: "Plan", width: 120 },
    { label: "Members", width: 110 },
    { label: "Issues", width: 110 },
    { label: "Health", width: 110 },
    { label: "Status", width: 130 },
  ];

  const rows: AdminTableCell[][] = scored.map((t) => [
    { kind: "bold", value: t.name },
    { kind: "mono", value: `/${t.slug}` },
    {
      kind: "chip",
      value: t.plan ?? "basic",
      chipFg: "#5a4a2f",
      chipBg: "#f4ead4",
    },
    { kind: "text", value: t.member_count },
    { kind: "text", value: t.issue_count },
    {
      kind: "chip",
      value: t.health,
      chipFg: healthColor(t.health),
      chipBg: t.health >= 70 ? "#e9f3ea" : t.health >= 40 ? "#fdf1de" : "#fbeae8",
    },
    {
      kind: "chip",
      value: t.status,
      chipFg: t.status === "active" ? "#3f7d4c" : "#c0392b",
      chipBg: t.status === "active" ? "#e9f3ea" : "#fbeae8",
    },
  ]);

  return (
    <main className="px-6 py-5">
      <PageHeader title="Platform Dashboard" subtitle="Every tenant on Forge-Worx" />

      <div className="mt-4 space-y-4">
        <StatsRow
          items={[
            { label: "Tenants", value: tenants.length, hint: "provisioned on the platform" },
            { label: "Seats sold", value: seatsSold, hint: "active memberships" },
            {
              label: "Health alerts",
              value: atRisk,
              hint: "tenants need attention",
              color: atRisk > 0 ? "#c0392b" : undefined,
            },
            { label: "Open support", value: openTickets, hint: "tickets open", color: openTickets > 0 ? "#c9791d" : undefined },
          ]}
        />

        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-bold text-[#20201d]">All Tenants</h2>
          <Link href="/admin/tenants" className="text-[11.5px] font-semibold text-[#c9791d] hover:underline">
            Manage all →
          </Link>
        </div>
        <AdminTable columns={columns} rows={rows} minWidth={760} />

        <h2 className="text-[13px] font-bold text-[#20201d]">Recent Activity</h2>
        <div className="fw-card overflow-hidden">
          {recentAudit.length === 0 ? (
            <p className="px-3.5 py-4 text-[12px] text-[#a19d90]">No audit events yet.</p>
          ) : (
            recentAudit.map((entry, i) => (
              <div
                key={entry.id}
                className={`flex items-center gap-3 px-3.5 py-[11px] ${i > 0 ? "border-t border-[#e3ded0]" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] text-[#4a473e]">
                    <strong className="text-[#20201d]">{entry.actor ?? "system"}</strong>{" "}
                    {entry.action}
                    {entry.target && (
                      <span className="ml-1 font-mono text-[10.5px] text-[#a19d90]">→ {entry.target}</span>
                    )}
                  </p>
                </div>
                <span className="shrink-0 text-[10.5px] text-[#a19d90]">{timeAgo(entry.created_at)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
