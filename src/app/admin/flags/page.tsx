import { listTenants } from "@/lib/services/platform";
import { requireSuperAdmin } from "@/lib/super-admin";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { featureFlagsRepo } from "@/lib/repositories/featureFlags";
import FeatureFlagsConsole from "./FeatureFlagsConsole";
import PageHeader from "@/components/patterns/PageHeader";

export default async function FlagsPage() {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  const svc = createSupabaseServiceClient();
  const repo = featureFlagsRepo(svc);
  const [tenants, flags, overrides, settingsResult] = await Promise.all([
    listTenants(),
    repo.listFlags().catch(() => []),
    repo.listOverrides().catch(() => []),
    svc.from("platform_settings").select("key, value").in("key", ["maintenance_mode", "ai_disabled", "platform_mfa_required"]),
  ]);
  const settingsMap: Record<string, string> = {};
  for (const row of (settingsResult.data ?? []) as { key: string; value: string }[]) {
    settingsMap[row.key] = row.value;
  }
  return (
    <main className="px-6 py-5">
      <PageHeader title="Feature Access" subtitle="Which plan unlocks which feature" />
      <FeatureFlagsConsole
        flags={flags}
        overrides={overrides}
        tenants={tenants.map((t) => ({ id: t.id, name: t.name, slug: t.slug }))}
        platformSettings={settingsMap}
      />
    </main>
  );
}
