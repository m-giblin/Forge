import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

/**
 * Session refresh for the Next.js proxy (formerly "middleware"). Refreshes the
 * Supabase auth cookie on each request and does an OPTIMISTIC redirect of
 * unauthenticated users to /login. Real authorization is NOT done here — it
 * lives in RLS + the server data layer (per Next's guidance and Architecture §8).
 */
/**
 * @param extraRequestHeaders  Additional headers to forward to Server Components
 *   (e.g. `{ 'x-nonce': nonce }` for CSP nonce injection). These are merged
 *   into the request headers so that `headers()` in RSC returns them.
 */
export async function updateSession(
  request: NextRequest,
  extraRequestHeaders?: Record<string, string>
) {
  // The integration API and SCIM provisioning both authenticate with bearer
  // tokens, not user sessions. Skip session work entirely so the machine path
  // pays no auth-cookie overhead.
  if (request.nextUrl.pathname.startsWith("/api/v1") || request.nextUrl.pathname.startsWith("/api/scim")) {
    return NextResponse.next({ request });
  }

  // Merge any extra headers (e.g. CSP nonce) into the forwarded request headers
  // so Server Components can read them via `import { headers } from 'next/headers'`.
  const forwardHeaders = new Headers(request.headers);
  if (extraRequestHeaders) {
    for (const [k, v] of Object.entries(extraRequestHeaders)) {
      forwardHeaders.set(k, v);
    }
  }

  let response = NextResponse.next({ request: { headers: forwardHeaders } });
  const env = publicEnv();

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        // Re-create with merged headers so extra headers survive the cookie-refresh path
        response = NextResponse.next({ request: { headers: forwardHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // IMPORTANT: getUser() (not getSession) triggers token refresh + revalidation.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // /join must be reachable signed-out so a new invitee can create an account.
  const isPublic =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/preview-landing") ||
    path.startsWith("/join") ||
    path.startsWith("/api/v1") ||
    path.startsWith("/api/scim") ||
    path.startsWith("/api/auth/") ||
    path.startsWith("/api/signup") ||
    path.startsWith("/api/cron/") ||
    path.startsWith("/api/email/inbound") ||
    path.startsWith("/api/webhooks/") ||
    path.startsWith("/auth/") ||
    path.startsWith("/shared") ||
    path.startsWith("/legal") ||
    path.startsWith("/design");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // M-3: only allow same-origin relative paths as redirect target (no open redirect)
    const safePath = path.startsWith("/") && !path.startsWith("//") ? path : "/";
    url.searchParams.set("next", safePath);
    return NextResponse.redirect(url);
  }

  return response;
}
