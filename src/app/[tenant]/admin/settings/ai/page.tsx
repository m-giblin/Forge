import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role required for AI key management (bypasses RLS by design); all calls go through tenantAiKeysRepo (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { tenantAiKeysRepo } from "@/lib/repositories/aiKeys";
import { getTenantSettings } from "@/lib/tenantSettings";
import AIProviderSettings from "./AIProviderSettings";
import AiPrivacySettings from "./AiPrivacySettings";

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
    <section className="space-y-8">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">AI Provider Settings</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Configure which AI model powers the Think Tank Sounding Board. Add a BYO key to
          use your own provider — usage and costs are billed directly to your API account.
        </p>
        <div className="mt-6">
          <AIProviderSettings slug={slug} savedKeys={savedKeys} isAdmin={isAdmin} />
        </div>
      </div>

      <AiPrivacySettings
        slug={slug}
        initialAiDisabled={privacySettings.ai_disabled === "true"}
        initialPiiScrub={privacySettings.ai_pii_scrub === "true"}
        isAdmin={isAdmin}
      />
    </section>
  );
}
