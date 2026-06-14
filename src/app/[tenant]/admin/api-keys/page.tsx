import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { listApiKeys } from "@/lib/services/apiKeys";
import ApiKeysManager from "./ApiKeysManager";

export default async function ApiKeysPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const readOnly = !(ctx.role === "owner" || ctx.role === "admin");

  return (
    <section>
      <h2 className="text-base font-semibold text-neutral-900">API keys</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Tenant-scoped keys for the integration API. Keys can only access this workspace, and you
        choose their permissions. The full key is shown once at creation.
      </p>
      <ApiKeysManager slug={slug} initialKeys={await listApiKeys(ctx.tenant.id, ctx.impersonating)} readOnly={readOnly} />
    </section>
  );
}
