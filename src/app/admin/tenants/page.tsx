import Link from "next/link";
import { listTenants } from "@/lib/services/platform";
import { getSdkSuspensionWindows } from "@/lib/services/sdkFallbackAlerts";
import AdminProvisionForm from "./AdminProvisionForm";
import SdkSuspensionWindowsSetting from "./SdkSuspensionWindowsSetting";
import PageHeader from "@/components/patterns/PageHeader";
import AdminTable, { type AdminTableCell } from "@/components/patterns/admin/AdminTable";
import Note from "@/components/patterns/admin/Note";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const [tenants, sdkSuspensionWindows, sp] = await Promise.all([listTenants(), getSdkSuspensionWindows(), searchParams]);

  const columns = [
    { label: "Tenant", flex: true },
    { label: "Slug", width: 150 },
    { label: "Plan", width: 120 },
    { label: "Created", width: 140 },
    { label: "Status", width: 130 },
    { label: "", width: 230 },
  ];

  const rows: AdminTableCell[][] = tenants.map((t) => [
    { kind: "bold", value: t.name },
    { kind: "mono", value: `/${t.slug}` },
    { kind: "chip", value: t.plan ?? "basic", chipFg: "#5a4a2f", chipBg: "#f4ead4" },
    { kind: "dim", value: new Date(t.created_at).toLocaleDateString() },
    {
      kind: "chip",
      value: t.status,
      chipFg: t.status === "active" ? "#3f7d4c" : "#c0392b",
      chipBg: t.status === "active" ? "#e9f3ea" : "#fbeae8",
    },
    {
      kind: "text",
      value: (
        <div className="flex justify-end">
          <Link href={`/admin/tenants/${t.id}`} className="text-[11.5px] font-semibold text-[#c9791d] hover:underline">
            Manage{t.status === "suspended" ? " · Reactivate" : " · Suspend"}
          </Link>
        </div>
      ),
    },
  ]);

  return (
    <main className="px-6 py-5">
      <PageHeader title="Tenants" subtitle="Provision, suspend and impersonate" />

      <div className="mt-4 space-y-4">
        {sp.deleted && <Note icon="✓" tone="info">{sp.deleted} was permanently deleted.</Note>}

        <div className="fw-card px-3.5 py-3">
          <h2 className="mb-3 text-[12.5px] font-bold text-[#20201d]">Provision New Workspace</h2>
          <AdminProvisionForm />
        </div>

        <div className="fw-card px-3.5 py-3">
          <h2 className="mb-2 text-[12.5px] font-bold text-[#20201d]">SDK Intake After Suspension</h2>
          <SdkSuspensionWindowsSetting notifyDays={sdkSuspensionWindows.notifyDays} graceDays={sdkSuspensionWindows.graceDays} />
        </div>

        <h2 className="text-[13px] font-bold text-[#20201d]">All Tenants ({tenants.length})</h2>
        <AdminTable columns={columns} rows={rows} minWidth={900} />
      </div>
    </main>
  );
}
