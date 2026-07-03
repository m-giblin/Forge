import Link from "next/link";
import { requireSuperAdmin } from "@/lib/super-admin";
import { redirect } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import ComplianceConsole from "./ComplianceConsole";
import { adminStyles as S } from "../page";

type RawRequest = { id: string; tenant_id: string | null; request_type: string; requester_email: string; status: string; regulation: string; notes: string | null; completed_at: string | null; created_at: string };
type TenantRow = { id: string; name: string; slug: string };

export default async function CompliancePage() {
  if (!(await requireSuperAdmin())) redirect("/");
  const svc = createSupabaseServiceClient();
  const [{ data: requestsRaw, error: rErr }, { data: tenantsRaw, error: tErr }] = await Promise.all([
    svc.from("compliance_requests").select("id, tenant_id, request_type, requester_email, status, regulation, notes, completed_at, created_at").order("created_at", { ascending: false }),
    svc.from("tenants").select("id, name, slug"),
  ]);
  if (rErr) throw rErr;
  if (tErr) throw tErr;
  const tenantMap = new Map<string, TenantRow>((tenantsRaw ?? []).map((t) => [t.id, t as TenantRow]));
  const requests = (requestsRaw ?? []).map((req: RawRequest) => ({ ...req, tenant_name: req.tenant_id ? (tenantMap.get(req.tenant_id)?.name ?? null) : null }));
  const tenants = (tenantsRaw ?? []) as TenantRow[];
  return (
    <main style={{ padding: "24px 28px", maxWidth: 1100 }}>
      <Link href="/admin" style={S.backLink}>← Dashboard</Link>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h1 style={S.pageTitle}>Compliance &amp; Data Governance</h1>
          <p style={S.pageSub}>Track GDPR, CCPA, and other data subject requests. All actions are logged.</p>
        </div>
        <Link href="/legal/sub-processors" target="_blank" style={{ fontSize: 11, padding: "6px 12px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#f8fafc", color: "#6b7280", textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap" }}>
          Sub-processors ↗
        </Link>
      </div>
      <ComplianceConsole requests={requests} tenants={tenants} />
    </main>
  );
}
