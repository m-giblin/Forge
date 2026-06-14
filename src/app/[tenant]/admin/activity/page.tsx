import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { listTenantAudit } from "@/lib/services/audit";
import AuditTable from "@/components/AuditTable";

export default async function TenantAuditPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  return (
    <section>
      <h2 className="text-base font-semibold text-neutral-900">Activity log</h2>
      <p className="mt-1 text-sm text-neutral-500">Member, invite, API-key, and field changes in this workspace.</p>
      <div className="mt-4">
        <AuditTable entries={await listTenantAudit(ctx.tenant.id, ctx.impersonating)} />
      </div>
    </section>
  );
}
