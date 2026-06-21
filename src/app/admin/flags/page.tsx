import { listGlobalFlags, listAllOverrides } from "@/lib/services/featureFlagsAdmin";
import { listTenants } from "@/lib/services/platform";
// eslint-disable-next-line no-restricted-imports -- admin/super-admin: service-role required, explicit tenant scoping applied (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import FeatureFlagsConsole from "./FeatureFlagsConsole";

export default async function FlagsPage() {
  // Fail gracefully if migration 0032 hasn't been run yet (table absent) — the
  // console then shows a "run the migration" message instead of crashing.
  const svc = createSupabaseServiceClient();

  const [tenants, flags, overrides, settingsResult] = await Promise.all([
    listTenants(),
    listGlobalFlags().catch(() => []),
    listAllOverrides().catch(() => []),
    svc
      .from("platform_settings")
      .select("key, value")
      .in("key", ["maintenance_mode", "ai_disabled"]),
  ]);

  const settingsMap: Record<string, string> = {};
  for (const row of (settingsResult.data ?? []) as { key: string; value: string }[]) {
    settingsMap[row.key] = row.value;
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-xl font-semibold text-white">Feature Flags</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Stage the rollout. The bug tracker (Issues + Board) always ships. A global default gates
        each feature; a per-tenant override lets you give specific workspaces early access.
      </p>
      <FeatureFlagsConsole
        flags={flags}
        overrides={overrides}
        tenants={tenants.map((t: { id: string; name: string; slug: string }) => ({ id: t.id, name: t.name, slug: t.slug }))}
        platformSettings={settingsMap}
      />
    </main>
  );
}
