import { listPlatformAudit } from "@/lib/services/audit";
import AuditTable from "@/components/AuditTable";

// Layout already gates this to super admins.
export default async function PlatformAuditPage() {
  const entries = await listPlatformAudit();
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-xl font-semibold text-white">Audit log</h1>
      <p className="mt-1 text-sm text-neutral-400">Platform-wide activity across all tenants.</p>
      <div className="mt-6">
        <AuditTable entries={entries} showTenant dark />
      </div>
    </main>
  );
}
