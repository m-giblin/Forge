import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function getTenantSetting(tenantId: string, key: string): Promise<string | null> {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("tenant_settings")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

export async function getTenantSettings(
  tenantId: string,
  keys: string[]
): Promise<Record<string, string>> {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("tenant_settings")
    .select("key, value")
    .eq("tenant_id", tenantId)
    .in("key", keys);
  const result: Record<string, string> = {};
  for (const row of data ?? []) result[row.key] = row.value;
  return result;
}

export async function setTenantSetting(
  tenantId: string,
  key: string,
  value: string
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("tenant_settings")
    .upsert({ tenant_id: tenantId, key, value, updated_at: new Date().toISOString() }, {
      onConflict: "tenant_id,key",
    });
  if (error) throw error;
}
