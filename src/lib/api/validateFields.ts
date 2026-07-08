import type { SupabaseClient } from "@supabase/supabase-js";
import { fieldConfigRepo } from "@/lib/repositories/fieldConfig";

// Hard caps that match the UI limits (MAX_CUSTOM_FIELDS=50, value inputs capped at 500 chars).
// These prevent a malicious tenant member from ballooning the issues.custom_values JSONB column.
const MAX_CUSTOM_KEYS = 50;
const MAX_VALUE_LEN = 500;

/**
 * Clamp an untrusted custom_values object before it reaches the DB.
 * - Drops any key beyond the first 50.
 * - Truncates any string value to 500 characters.
 * - Silently drops non-string values (all legitimate values are strings).
 */
export function sanitizeCustomValues(
  raw: Record<string, unknown> | undefined | null
): Record<string, string> {
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (Object.keys(out).length >= MAX_CUSTOM_KEYS) break;
    if (typeof v === "string") out[k] = v.slice(0, MAX_VALUE_LEN);
  }
  return out;
}

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
