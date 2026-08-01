import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required, tenant context verified by getTenantContext (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { customRolesRepo } from "@/lib/repositories/customRoles";
import { permissionDefinitionsRepo } from "@/lib/repositories/permissionDefinitions";
import { loadTenantFlags } from "@/lib/services/featureFlags";
import RolesManager from "./RolesManager";
import PageHeader from "@/components/patterns/PageHeader";

export default async function RolesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect(`/${slug}/board`);

  const flags = await loadTenantFlags(ctx.tenant.id);
  if (!flags.rbac) redirect(`/${slug}/admin`);

  const svc = createSupabaseServiceClient();
  const [roles, permissions] = await Promise.all([
    customRolesRepo(svc).list(ctx.tenant.id),
    permissionDefinitionsRepo(svc).listActive(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Custom Roles" subtitle="Named permission sets layered on Admin / Member / Viewer" />
      <div className="px-6">
        <RolesManager slug={slug} initialRoles={roles} permissions={permissions} />
      </div>
    </div>
  );
}
