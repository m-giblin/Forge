import { requireSuperAdmin } from "@/lib/super-admin";
import { redirect } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- admin/super-admin: service-role required, explicit tenant scoping applied (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import ComplianceConsole from "./ComplianceConsole";

type RawRequest = {
  id: string;
  tenant_id: string | null;
  request_type: string;
  requester_email: string;
  status: string;
  regulation: string;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
};

type TenantRow = { id: string; name: string; slug: string };

export default async function CompliancePage() {
  if (!(await requireSuperAdmin())) redirect("/");

  const svc = createSupabaseServiceClient();

  const [{ data: requestsRaw, error: rErr }, { data: tenantsRaw, error: tErr }] =
    await Promise.all([
      svc
        .from("compliance_requests")
        .select(
          "id, tenant_id, request_type, requester_email, status, regulation, notes, completed_at, created_at"
        )
        .order("created_at", { ascending: false }),
      svc.from("tenants").select("id, name, slug"),
    ]);

  if (rErr) throw rErr;
  if (tErr) throw tErr;

  const tenantMap = new Map<string, TenantRow>(
    (tenantsRaw ?? []).map((t) => [t.id, t as TenantRow])
  );

  const requests = (requestsRaw ?? []).map((req: RawRequest) => ({
    ...req,
    tenant_name: req.tenant_id ? (tenantMap.get(req.tenant_id)?.name ?? null) : null,
  }));

  const tenants = (tenantsRaw ?? []) as TenantRow[];

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Compliance &amp; Data Governance</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Track GDPR, CCPA, and other data subject requests. All actions are logged.
        </p>
      </div>
      <ComplianceConsole requests={requests} tenants={tenants} />
    </main>
  );
}
