import type { SupabaseClient } from "@supabase/supabase-js";
import { fieldConfigRepo } from "@/lib/repositories/fieldConfig";

type Vals = { status?: string | null; priority?: string | null; type?: string | null };

/**
 * Validate provided status/priority/type against the tenant's configured
 * options (machine path). Also returns the tenant's default keys so callers can
 * fill in unspecified fields. Pass a tenant-scoped client (service-role on the
 * API path). Unknown value → { ok:false } with a helpful message.
 */
export async function resolveFieldValues(
  supabase: SupabaseClient,
  tenantId: string,
  vals: Vals
): Promise<{ ok: true; defaults: Record<string, string> } | { ok: false; message: string }> {
  const options = await fieldConfigRepo(supabase).listOptions(tenantId);
  const byField = (f: string) => options.filter((o) => o.field === f);

  for (const field of ["status", "priority", "type"] as const) {
    const v = vals[field];
    if (v == null) continue;
    const allowed = byField(field).map((o) => o.key);
    if (!allowed.includes(v)) {
      return { ok: false, message: `Invalid ${field} "${v}". Allowed: ${allowed.join(", ")}.` };
    }
  }

  const defaults: Record<string, string> = {};
  for (const field of ["status", "priority", "type"] as const) {
    const opts = byField(field);
    defaults[field] = (opts.find((o) => o.is_default) ?? opts[0])?.key ?? "";
  }
  return { ok: true, defaults };
}
