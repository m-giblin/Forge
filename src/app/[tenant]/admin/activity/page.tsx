import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { listTenantAudit } from "@/lib/services/audit";
import { timeAgo } from "@/lib/formatRelativeTime";
import PageHeader from "@/components/patterns/PageHeader";
import AdminTable, { type AdminTableCell } from "@/components/patterns/admin/AdminTable";

export default async function TenantAuditPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const entries = await listTenantAudit(ctx.tenant.id, ctx.impersonating);

  const rows: AdminTableCell[][] = entries.map((e) => [
    { kind: "dim", value: timeAgo(e.created_at) },
    { kind: "text", value: e.actor ?? "System" },
    { kind: "text", value: e.action },
    { kind: "bold", value: e.target ?? "—" },
    { kind: "mono", value: "—" },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Log" subtitle="Every privileged action in this workspace" />

      <div className="px-6">
        <AdminTable
          columns={[
            { label: "When", width: 150 },
            { label: "Actor", width: 170 },
            { label: "Action", flex: true },
            { label: "Target", width: 200 },
            { label: "IP", width: 130 },
          ]}
          rows={rows}
        />
        {rows.length === 0 && (
          <p className="mt-3 text-[12.5px] text-[#726e60]">No activity yet.</p>
        )}
      </div>
    </div>
  );
}
