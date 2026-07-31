import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const CONFIG_KEY = "figma_integration";

export type FigmaConfig = { enabled: boolean; teamUrl: string };

const DEFAULT_CONFIG: FigmaConfig = { enabled: false, teamUrl: "" };

/**
 * Basic connect-card config only — enable/disable + a team URL, matching the
 * design's simple "connect card" spec. No real Figma API/OAuth integration or
 * design-file linking on issues exists yet; that workflow hasn't been scoped.
 *
 * Uses the real per-tenant key-value table (`tenant_settings`, migration 0010).
 */
export async function getFigmaConfig(tenantId: string): Promise<FigmaConfig> {
  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("tenant_settings")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", CONFIG_KEY)
    .maybeSingle();
  if (!data) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(data.value as string);
    return {
      enabled: Boolean(parsed.enabled),
      teamUrl: typeof parsed.teamUrl === "string" ? parsed.teamUrl : "",
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveFigmaConfig(tenantId: string, config: FigmaConfig): Promise<void> {
  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("tenant_settings").upsert(
    { tenant_id: tenantId, key: CONFIG_KEY, value: JSON.stringify(config) },
    { onConflict: "tenant_id,key" }
  );
  if (error) throw error;
}
