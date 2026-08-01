import Link from "next/link";
import { requireSuperAdmin } from "@/lib/super-admin";
import { redirect } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import ComplianceConsole from "./ComplianceConsole";
import PageHeader from "@/components/patterns/PageHeader";

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
    <main className="px-6 py-5">
      <PageHeader
        title="Compliance"
        subtitle="GDPR, CCPA and SOC 2 posture"
        right={
          <Link href="/legal/sub-processors" target="_blank" className="whitespace-nowrap rounded-md border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-[6px] text-[11px] font-semibold text-[#4a473e]">
            Sub-processors ↗
          </Link>
        }
      />
      <ComplianceConsole requests={requests} tenants={tenants} />
    </main>
  );
}
