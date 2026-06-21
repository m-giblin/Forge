import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required, tenant context verified by getTenantContext (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { customRolesRepo } from "@/lib/repositories/customRoles";
import { loadTenantFlags } from "@/lib/services/featureFlags";
import RolesManager from "./RolesManager";

export default async function RolesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect(`/${slug}/board`);

  const flags = await loadTenantFlags(ctx.tenant.id);
  if (!flags.rbac) redirect(`/${slug}/admin`);

  const svc = createSupabaseServiceClient();
  const roles = await customRolesRepo(svc).list(ctx.tenant.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Custom Roles</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Define named roles with specific permission sets. Assign them to members on the{" "}
          <a href={`/${slug}/admin/members`} className="text-indigo-600 hover:underline">Members page</a>.
        </p>
      </div>
      <RolesManager slug={slug} initialRoles={roles} />
    </div>
  );
}
