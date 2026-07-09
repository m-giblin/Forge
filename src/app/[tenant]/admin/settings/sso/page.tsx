import { getTenantContext } from "@/lib/auth";
import { redirect } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- service-role: SSO config read for admin page
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ssoConfigRepo } from "@/lib/repositories/ssoConfig";
import { getScimTokenStatus } from "@/lib/services/scim";
import SsoSettingsClient from "./SsoSettingsClient";

export default async function SsoSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (!["owner", "admin"].includes(ctx.role)) redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();
  const [config, scimStatus] = await Promise.all([
    ssoConfigRepo(svc).get(ctx.tenant.id).catch(() => null),
    getScimTokenStatus(ctx.tenant.id).catch(() => ({ configured: false, lastUsedAt: null })),
  ]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <SsoSettingsClient slug={slug} initial={config} scimStatus={scimStatus} />
    </div>
  );
}
