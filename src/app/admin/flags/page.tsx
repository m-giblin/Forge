import Link from "next/link";
import { listTenants } from "@/lib/services/platform";
import { requireSuperAdmin } from "@/lib/super-admin";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { featureFlagsRepo } from "@/lib/repositories/featureFlags";
import FeatureFlagsConsole from "./FeatureFlagsConsole";
import { adminStyles as S } from "../page";

export default async function FlagsPage() {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  const svc = createSupabaseServiceClient();
  const repo = featureFlagsRepo(svc);
  const [tenants, flags, overrides, settingsResult] = await Promise.all([
    listTenants(),
    repo.listFlags().catch(() => []),
    repo.listOverrides().catch(() => []),
    svc.from("platform_settings").select("key, value").in("key", ["maintenance_mode", "ai_disabled"]),
  ]);
  const settingsMap: Record<string, string> = {};
  for (const row of (settingsResult.data ?? []) as { key: string; value: string }[]) {
    settingsMap[row.key] = row.value;
  }
  return (
    <main style={{ padding: "24px 28px", maxWidth: 1100 }}>
      <Link href="/admin" style={S.backLink}>← Dashboard</Link>
      <div style={{ marginBottom: 22 }}>
        <h1 style={S.pageTitle}>Feature Access</h1>
        <p style={S.pageSub}>Global defaults gate each feature. Per-tenant overrides give specific workspaces early or restricted access.</p>
      </div>
      <FeatureFlagsConsole
        flags={flags}
        overrides={overrides}
        tenants={tenants.map((t) => ({ id: t.id, name: t.name, slug: t.slug }))}
        platformSettings={settingsMap}
      />
    </main>
  );
}
