import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { extractClientIp, isIpAllowed } from "@/lib/services/ipAllowlist";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// In-memory cache: tenantSlug → { list, fetchedAt }. Refreshes every 10 s.
// Short TTL ensures IP revocations propagate quickly across serverless instances.
const _allowlistCache = new Map<string, { list: string[]; at: number }>();

async function checkIpAllowlist(slug: string, clientIp: string): Promise<boolean> {
  const now = Date.now();
  const cached = _allowlistCache.get(slug);
  if (cached && now - cached.at < 10_000) {
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

  // Enforce IP allowlist for authenticated routes: /[slug]/... AND session /api/ calls.
  // Machine API (/api/v1/) is excluded — it uses API-key auth with its own rate limits.
  // Public paths are excluded entirely.
  const tenantRouteMatch = path.match(/^\/([a-z0-9-]+)\//);
  const ALWAYS_SKIP = ["/api/v1/", "/api/auth/", "/api/cron/", "/admin", "/login", "/join", "/shared", "/legal", "/feedback", "/auth/", "/design", "/_next"];
  const alwaysSkip = ALWAYS_SKIP.some((p) => path.startsWith(p));

  if (!alwaysSkip) {
    // For /[slug]/... routes, slug is the first path segment.
    // For session /api/ routes, slug is passed as ?slug= query param.
    const slug =
      tenantRouteMatch?.[1] ??
      (path.startsWith("/api/") ? request.nextUrl.searchParams.get("slug") ?? null : null);

    if (slug) {
      const clientIp = extractClientIp(request.headers) ?? "unknown";
      const allowed = await checkIpAllowlist(slug, clientIp);
      if (!allowed) {
        return new NextResponse(
          JSON.stringify({ error: "Access denied: your IP address is not on the allowlist for this workspace." }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }
  }

  return await updateSession(request);
}

export const config = {
  // Run on everything except static assets and image optimizer.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
