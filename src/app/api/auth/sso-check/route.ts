import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line no-restricted-imports -- service-role: pre-auth domain lookup, no session exists yet (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ssoConfigRepo } from "@/lib/repositories/ssoConfig";
import { getRateLimiter } from "@/lib/providers/rate-limiter";

export const runtime = "nodejs";

// Same throttle class as login itself — this is a pre-auth, unauthenticated
// lookup, so it needs its own rate limit independent of the login endpoint's.
const CHECK_LIMIT = 30;
const CHECK_WINDOW_MS = 60_000;

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * GET /api/auth/sso-check?domain=acme.com
 * Returns only { available: boolean } — never the domain, tenant, or provider
 * details — so this can't be used to enumerate which companies use Forge.
 */
export async function GET(req: NextRequest) {
  const rl = getRateLimiter();
  const { allowed } = await rl.check(`ssocheck:${clientIp(req)}`, CHECK_LIMIT, CHECK_WINDOW_MS);
  if (!allowed) return NextResponse.json({ available: false }, { status: 429 });

  const domain = req.nextUrl.searchParams.get("domain")?.trim().toLowerCase();
  if (!domain || !domain.includes(".")) return NextResponse.json({ available: false });

  const svc = createSupabaseServiceClient();
  const samlDomain = await ssoConfigRepo(svc).getSamlDomain(domain).catch(() => null);
  return NextResponse.json({ available: !!samlDomain });
}
