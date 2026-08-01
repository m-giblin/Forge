import { listPlatformAudit } from "@/lib/services/audit";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import PageHeader from "@/components/patterns/PageHeader";
import AdminTable, { type AdminTableCell } from "@/components/patterns/admin/AdminTable";

export default async function PlatformAuditPage() {
  const [entries, tenantsResult] = await Promise.all([
    listPlatformAudit(),
    createSupabaseServiceClient().from("tenants").select("id, name"),
  ]);

  const tenantNames: Record<string, string> = {};
  for (const t of tenantsResult.data ?? []) {
    tenantNames[t.id] = t.name;
  }

  const columns = [
    { label: "When", width: 150 },
    { label: "Admin", width: 200 },
    { label: "Action", flex: true },
    { label: "Tenant", width: 190 },
  ];

  const rows: AdminTableCell[][] = entries.map((e) => [
    { kind: "dim", value: new Date(e.created_at).toLocaleString() },
    { kind: "bold", value: e.actor ?? "system" },
    { kind: "mono", value: e.action },
    { kind: "dim", value: e.tenant_id ? (tenantNames[e.tenant_id] ?? e.tenant_id.slice(0, 8)) : "platform" },
  ]);

  return (
    <main className="px-6 py-5">
      <PageHeader title="Audit Log" subtitle="Platform staff actions" />
      <div className="mt-4">
        <AdminTable columns={columns} rows={rows} minWidth={800} />
      </div>
    </main>
  );
}
