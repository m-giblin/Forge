import { adminStyles as S } from "../page";
import { requireSuperAdmin } from "@/lib/super-admin";
import { redirect } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import AiAnalyticsClient from "./AiAnalyticsClient";

export default async function AiAnalyticsPage() {
  const sa = await requireSuperAdmin();
  if (!sa) redirect("/");

  const svc = createSupabaseServiceClient();

  // Parallel-fetch all AI data
  const [
    { data: turnsRaw },
    { data: keysRaw },
    { data: tenantsRaw },
    { data: flagsRaw },
    { data: settingsRaw },
  ] = await Promise.all([
    svc
      .from("idea_ai_turns")
      .select("id, tenant_id, provider, tokens_input, tokens_output, created_at")
      .order("created_at", { ascending: false }),
    svc
      .from("tenant_ai_keys")
      .select("id, tenant_id, provider, is_active, created_at"),
    svc.from("tenants").select("id, name, slug"),
    svc.from("feature_flags").select("key, enabled"),
    svc.from("platform_settings").select("key, value"),
  ]);

  const turns = (turnsRaw ?? []) as {
    id: string; tenant_id: string; provider: string | null;
    tokens_input: number | null; tokens_output: number | null; created_at: string;
  }[];

  const keys = (keysRaw ?? []) as {
    id: string; tenant_id: string; provider: string; is_active: boolean; created_at: string;
  }[];

  const tenantMap: Record<string, string> = {};
  for (const t of tenantsRaw ?? []) tenantMap[t.id as string] = t.name as string;

  const aiDisabled = (settingsRaw ?? []).find((s) => s.key === "ai_disabled")?.value === "true";
  const thinkTankFlag = (flagsRaw ?? []).find((f) => f.key === "think_tank")?.enabled ?? false;

  // Aggregate per-tenant stats
  type TenantStat = {
    id: string; name: string;
    turns: number; tokens_in: number; tokens_out: number;
    providers: Set<string>;
    last_used: string | null;
    has_byo_key: boolean;
  };

  const statsMap = new Map<string, TenantStat>();
  for (const t of turns) {
    const name = tenantMap[t.tenant_id] ?? t.tenant_id.slice(0, 8);
    if (!statsMap.has(t.tenant_id)) {
      statsMap.set(t.tenant_id, {
        id: t.tenant_id, name, turns: 0, tokens_in: 0, tokens_out: 0,
        providers: new Set(), last_used: null, has_byo_key: false,
      });
    }
    const s = statsMap.get(t.tenant_id)!;
    s.turns++;
    s.tokens_in  += t.tokens_input  ?? 0;
    s.tokens_out += t.tokens_output ?? 0;
    if (t.provider) s.providers.add(t.provider);
    if (!s.last_used || t.created_at > s.last_used) s.last_used = t.created_at;
  }

  for (const k of keys) {
    if (!k.is_active) continue;
    if (!statsMap.has(k.tenant_id)) {
      const name = tenantMap[k.tenant_id] ?? k.tenant_id.slice(0, 8);
      statsMap.set(k.tenant_id, {
        id: k.tenant_id, name, turns: 0, tokens_in: 0, tokens_out: 0,
        providers: new Set(), last_used: null, has_byo_key: true,
      });
    }
    statsMap.get(k.tenant_id)!.has_byo_key = true;
  }

  // Provider breakdown across all turns
  const providerTotals: Record<string, { turns: number; tokens: number }> = {};
  for (const t of turns) {
    const p = t.provider ?? "unknown";
    if (!providerTotals[p]) providerTotals[p] = { turns: 0, tokens: 0 };
    providerTotals[p].turns++;
    providerTotals[p].tokens += (t.tokens_input ?? 0) + (t.tokens_output ?? 0);
  }

  // Last 30 days daily usage (for sparkline data)
  const dailyMap: Record<string, number> = {};
  const now = Date.now();
  for (const t of turns) {
    const msAgo = now - new Date(t.created_at).getTime();
    if (msAgo > 30 * 86_400_000) continue;
    const day = t.created_at.slice(0, 10);
    dailyMap[day] = (dailyMap[day] ?? 0) + 1;
  }

  const tenantStats = [...statsMap.values()]
    .map((s) => ({ ...s, providers: [...s.providers] }))
    .sort((a, b) => b.turns - a.turns);

  return (
    <main style={{ padding: "24px 28px", maxWidth: 1100 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={S.pageTitle}>AI Analytics</h1>
        <p style={S.pageSub}>Usage, tokens, and BYO key config across all tenants.</p>
      </div>

      <AiAnalyticsClient
        totalTurns={turns.length}
        totalTokens={turns.reduce((s, t) => s + (t.tokens_input ?? 0) + (t.tokens_output ?? 0), 0)}
        tenantsUsingAI={statsMap.size}
        byoKeyCount={keys.filter((k) => k.is_active).length}
        aiDisabled={aiDisabled}
        thinkTankEnabled={thinkTankFlag as boolean}
        providerTotals={providerTotals}
        tenantStats={tenantStats}
        tenantMap={tenantMap}
        dailyMap={dailyMap}
      />
    </main>
  );
}
