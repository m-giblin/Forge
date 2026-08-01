import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role required for AI key management (bypasses RLS by design); all calls go through tenantAiKeysRepo (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { tenantAiKeysRepo } from "@/lib/repositories/aiKeys";
import { getTenantSettings } from "@/lib/tenantSettings";
import AIProviderSettings from "./AIProviderSettings";
import AiPrivacySettings from "./AiPrivacySettings";
import PageHeader from "@/components/patterns/PageHeader";

export default async function AISettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const isAdmin = ctx.role === "owner" || ctx.role === "admin";

  const svc = createSupabaseServiceClient();
  const [savedKeys, privacySettings] = await Promise.all([
    tenantAiKeysRepo(svc).listSavedKeys(ctx.tenant.id),
    getTenantSettings(ctx.tenant.id, ["ai_disabled", "ai_pii_scrub"]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="AI Settings" subtitle="Provider, privacy and which features use AI" />
      <div className="max-w-2xl space-y-6 px-6">
        <div>
          <h2 className="mb-2 text-[12.5px] font-bold text-[#20201d]">Provider</h2>
          <p className="mb-2 text-[11px] text-[#726e60]">
            Configure which AI model powers the Think Tank Sounding Board. Add a BYO key to
            use your own provider — usage and costs are billed directly to your API account.
          </p>
          <AIProviderSettings slug={slug} savedKeys={savedKeys} isAdmin={isAdmin} />
        </div>

        <AiPrivacySettings
          slug={slug}
          initialAiDisabled={privacySettings.ai_disabled === "true"}
          initialPiiScrub={privacySettings.ai_pii_scrub === "true"}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
