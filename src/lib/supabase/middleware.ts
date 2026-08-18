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
    // Next.js metadata routes served at the root — crawlers and browsers hit
    // these with no session at all. Confirmed live: without this they 307'd
    // to /login, silently defeating robots.txt/sitemap.xml/PWA installability.
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    path === "/manifest.json" ||
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
    // forge-sdk.js (and the rrweb recorder it self-hosts for session replay)
    // are public embeddable scripts meant to run on a customer's own website
    // — real end users there have never logged into Forge, so these must
    // never require a session or they can't load at all.
    path === "/forge-sdk.js" ||
    path === "/rrweb-recorder.min.js" ||
    path.startsWith("/auth/") ||
    path.startsWith("/shared") ||
    // The Spaces guest-access flow (magic-link request/verify) is called by an
    // anonymous visitor with no session — without this, the fetch() calls in
    // GuestPageClient.tsx get redirected to /login and receive HTML instead
    // of JSON, breaking guest sign-in entirely.
    path.startsWith("/api/spaces/guest") ||
    // Public intake-form submission page — anonymous, no session. The Server
    // Action it calls (submitIntakeAction) posts to this same URL, so this
    // one allowlist entry covers both the page load and the submission.
    path.startsWith("/intake") ||
    path.startsWith("/legal") ||
    path.startsWith("/design");

  if (!user && !isPublic) {
    // Carry the original query string into `next` too, not just the
    // pathname — otherwise every param a page relies on for persisted state
    // (Sprint Board's collapsed columns, active filters, etc.) silently
    // drops on any login/session-refresh round-trip. Confirmed live: a
    // signed-out or session-expired hit on /travli/board?pri=medium came
    // back from /login at plain /travli/board, no ?pri.
    const safePath = path.startsWith("/") && !path.startsWith("//") ? path : "/";
    const safeNext = safePath + request.nextUrl.search;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", safeNext);
    return NextResponse.redirect(url);
  }

  return response;
}
