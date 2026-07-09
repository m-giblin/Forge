import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { permissionDefinitionsRepo } from "@/lib/repositories/permissionDefinitions";
import type { PermissionDefaults } from "@/lib/rbac";

// permission_definitions is platform-wide and changes rarely (an admin
// action, not a per-request event), so cache it in-memory with a short TTL —
// same pattern as the IP-allowlist cache in proxy.ts. Worst case on a cold
// serverless instance is one extra read; this is purely an optimization.
let cache: { defaults: PermissionDefaults; at: number } | null = null;
const TTL_MS = 30_000;

/** Loads member/viewer default access per permission key, for ctxCanDo()'s fallback path. Fails open (empty map) on read error so a DB hiccup never breaks an otherwise-working workspace. */
export async function loadPermissionDefaults(): Promise<PermissionDefaults> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.defaults;

  try {
    const svc = createSupabaseServiceClient();
    const defs = await permissionDefinitionsRepo(svc).listActive();
    const defaults: PermissionDefaults = Object.fromEntries(
      defs.map((d) => [d.key, { member: d.memberDefault, viewer: d.viewerDefault }])
    );
    cache = { defaults, at: now };
    return defaults;
  } catch {
    return cache?.defaults ?? {};
  }
}
