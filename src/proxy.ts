import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { extractClientIp, isIpAllowed } from "@/lib/services/ipAllowlist";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// In-memory cache: tenantSlug → { list, fetchedAt }. Refreshes every 60 s.
const _allowlistCache = new Map<string, { list: string[]; at: number }>();

async function checkIpAllowlist(slug: string, clientIp: string): Promise<boolean> {
  const now = Date.now();
  const cached = _allowlistCache.get(slug);
  if (cached && now - cached.at < 60_000) {
    return isIpAllowed(clientIp, cached.list);
  }
  try {
    const svc = createSupabaseServiceClient();
    const { data: tenant } = await svc.from("tenants").select("id").eq("slug", slug).maybeSingle();
    if (!tenant) return true; // unknown tenant — let the app handle it
    const { data: cfg } = await svc
      .from("platform_config")
      .select("value")
      .eq("tenant_id", tenant.id)
      .eq("key", "ip_allowlist")
      .maybeSingle();
    const list: string[] = cfg ? (() => { try { const p = JSON.parse(cfg.value as string); return Array.isArray(p) ? p : []; } catch { return []; } })() : [];
    _allowlistCache.set(slug, { list, at: now });
    return isIpAllowed(clientIp, list);
  } catch {
    return true; // fail open — never block on DB error
  }
}

// Next.js 16: "middleware" is now "proxy". Single file at the app's root level.
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Enforce IP allowlist for authenticated tenant routes: /[slug]/...
  // Skip public paths, API, admin, shared, and legal routes.
  const tenantRouteMatch = path.match(/^\/([a-z0-9-]+)\//);
  const SKIP_PREFIXES = ["/api/", "/admin", "/login", "/join", "/shared", "/legal", "/feedback", "/auth/", "/design", "/_next"];
  const skipIpCheck = SKIP_PREFIXES.some((p) => path.startsWith(p));

  if (tenantRouteMatch && !skipIpCheck) {
    const slug = tenantRouteMatch[1]!;
    const clientIp = extractClientIp(request.headers) ?? "unknown";
    const allowed = await checkIpAllowlist(slug, clientIp);
    if (!allowed) {
      return new NextResponse(
        JSON.stringify({ error: "Access denied: your IP address is not on the allowlist for this workspace." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  return await updateSession(request);
}

export const config = {
  // Run on everything except static assets and image optimizer.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
