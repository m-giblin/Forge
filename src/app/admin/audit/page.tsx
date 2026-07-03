import Link from "next/link";
import { listPlatformAudit } from "@/lib/services/audit";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import AuditTable from "@/components/AuditTable";
import { adminStyles as S } from "../page";

export default async function PlatformAuditPage() {
  const [entries, tenantsResult] = await Promise.all([
    listPlatformAudit(),
    createSupabaseServiceClient().from("tenants").select("id, name"),
  ]);

  const tenantNames: Record<string, string> = {};
  for (const t of tenantsResult.data ?? []) {
    tenantNames[t.id] = t.name;
  }

  return (
    <main style={{ padding: "24px 28px", maxWidth: 1100 }}>
      <Link href="/admin" style={S.backLink}>← Dashboard</Link>
      <div style={{ marginBottom: 22 }}>
        <h1 style={S.pageTitle}>Audit Log</h1>
        <p style={S.pageSub}>Platform-wide activity across all tenants.</p>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        <AuditTable entries={entries} showTenant tenantNames={tenantNames} />
      </div>
    </main>
  );
}
