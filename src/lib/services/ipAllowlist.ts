import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const CONFIG_KEY = "ip_allowlist";

/**
 * Fetch the IP allowlist for a tenant.
 * Returns an empty array if not configured (allowlist off = all IPs allowed).
 */
export async function getIpAllowlist(tenantId: string): Promise<string[]> {
  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("platform_config")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", CONFIG_KEY)
    .maybeSingle();
  if (!data) return [];
  try {
    const parsed = JSON.parse(data.value as string);
    return Array.isArray(parsed) ? (parsed as string[]).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function saveIpAllowlist(tenantId: string, entries: string[]): Promise<void> {
  const svc = createSupabaseServiceClient();
  await svc.from("platform_config").upsert(
    { tenant_id: tenantId, key: CONFIG_KEY, value: JSON.stringify(entries) },
    { onConflict: "tenant_id,key" }
  );
}

export async function clearIpAllowlist(tenantId: string): Promise<void> {
  const svc = createSupabaseServiceClient();
  await svc.from("platform_config").delete().eq("tenant_id", tenantId).eq("key", CONFIG_KEY);
}

/**
 * Parse an IP string into its numeric form (IPv4 only for now).
 * Returns null if not parseable.
 */
function ipToNum(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
  return ((nums[0]! << 24) | (nums[1]! << 16) | (nums[2]! << 8) | nums[3]!) >>> 0;
}

/**
 * Check whether a given IP (string) matches an allowlist entry (CIDR or exact).
 * Supports IPv4. IPv6 entries are compared as exact strings only.
 */
function ipMatches(ip: string, entry: string): boolean {
  const trimmedEntry = entry.trim();
  if (trimmedEntry.includes("/")) {
    // CIDR notation
    const [base, bits] = trimmedEntry.split("/");
    const prefixLen = parseInt(bits ?? "32", 10);
    if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return false;
    const ipNum = ipToNum(ip);
    const baseNum = ipToNum(base ?? "");
    if (ipNum === null || baseNum === null) return false;
    const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
    return (ipNum & mask) >>> 0 === (baseNum & mask) >>> 0;
  }
  // Exact match
  return ip.trim() === trimmedEntry;
}

/**
 * Returns true if the IP is allowed (either allowlist is empty or IP is in list).
 * Call this AFTER fetching the allowlist from the DB.
 */
export function isIpAllowed(ip: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true; // no restriction configured
  return allowlist.some((entry) => ipMatches(ip, entry));
}

/**
 * Extract the real client IP from request headers.
 * Prefers X-Forwarded-For (Vercel/proxies set this), falls back to x-real-ip.
 */
export function extractClientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip");
}
