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
    <ApiKeysManager slug={slug} initialKeys={await listApiKeys(ctx.tenant.id, ctx.impersonating)} readOnly={readOnly} />
  );
}
