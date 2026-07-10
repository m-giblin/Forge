import { adminStyles as S } from "../page";
import { requireSuperAdmin } from "@/lib/super-admin";
import { redirect } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import AiAnalyticsClient from "./AiAnalyticsClient";

export type UsageRow = {
  tenantId: string;
  tenantName: string;
  feature: string;
  model: string;
  keySource: "platform" | "byo";
  inputTokens: number;
  outputTokens: number;
  costCents: number; // real dollars, not hundredths-of-a-cent — converted server-side
  createdAt: string;
};

export default async function AiAnalyticsPage() {
  const sa = await requireSuperAdmin();
  if (!sa) redirect("/");

  const svc = createSupabaseServiceClient();

  const [
    { data: usageRaw, error: usageError },
    { data: keysRaw },
    { data: tenantsRaw },
    { data: flagsRaw },
    { data: settingsRaw },
  ] = await Promise.all([
    // Full history. At current volume (fractions of a cent per project) this
    // is a few thousand rows at most — revisit with a rollup table only if
    // this ever grows past what a single query comfortably returns.
    svc
      .from("ai_usage_events")
      .select("tenant_id, feature, model, key_source, input_tokens, output_tokens, est_cost_hundredth_cents, created_at, tenants(name)")
      .order("created_at", { ascending: false })
      .limit(50_000),
    svc
      .from("tenant_ai_keys")
      .select("id, tenant_id, provider, is_active, created_at"),
    svc.from("tenants").select("id, name, slug"),
    svc.from("feature_flags").select("key, enabled"),
    svc.from("platform_settings").select("key, value"),
  ]);

  const notYetMigrated = !!usageError;

  const tenantMap: Record<string, string> = {};
  for (const t of tenantsRaw ?? []) tenantMap[t.id as string] = t.name as string;

  const usageRows: UsageRow[] = notYetMigrated ? [] : ((usageRaw ?? []) as Array<Record<string, unknown>>).map((r) => ({
    tenantId: r.tenant_id as string,
    tenantName: ((r.tenants as { name: string } | null)?.name) ?? tenantMap[r.tenant_id as string] ?? (r.tenant_id as string).slice(0, 8),
    feature: r.feature as string,
    model: r.model as string,
    keySource: r.key_source as "platform" | "byo",
    inputTokens: (r.input_tokens as number) ?? 0,
    outputTokens: (r.output_tokens as number) ?? 0,
    costCents: ((r.est_cost_hundredth_cents as number) ?? 0) / 100,
    createdAt: r.created_at as string,
  }));

  const keys = (keysRaw ?? []) as { id: string; tenant_id: string; provider: string; is_active: boolean }[];
  const aiDisabled = (settingsRaw ?? []).find((s) => s.key === "ai_disabled")?.value === "true";
  const thinkTankFlag = (flagsRaw ?? []).find((f) => f.key === "think_tank")?.enabled ?? false;

  return (
    <main style={{ padding: "24px 28px", maxWidth: 1200 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={S.pageTitle}>AI Analytics</h1>
        <p style={S.pageSub}>Usage, real cost, and BYO key config across all tenants — every AI feature, not just Think Tank.</p>
      </div>

      <AiAnalyticsClient
        usageRows={usageRows}
        notYetMigrated={notYetMigrated}
        byoKeyCount={keys.filter((k) => k.is_active).length}
        aiDisabled={aiDisabled}
        thinkTankEnabled={thinkTankFlag as boolean}
      />
    </main>
  );
}
