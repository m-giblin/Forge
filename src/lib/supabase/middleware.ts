import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

/**
 * Session refresh for the Next.js proxy (formerly "middleware"). Refreshes the
 * Supabase auth cookie on each request and does an OPTIMISTIC redirect of
 * unauthenticated users to /login. Real authorization is NOT done here — it
 * lives in RLS + the server data layer (per Next's guidance and Architecture §8).
 */
export async function updateSession(request: NextRequest) {
  // The integration API authenticates with API keys, not user sessions. Skip
  // session work entirely so the machine path pays no auth-cookie overhead.
  if (request.nextUrl.pathname.startsWith("/api/v1")) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const env = publicEnv();

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
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
  const isPublic = path.startsWith("/login") || path.startsWith("/join") || path.startsWith("/api/v1") || path.startsWith("/api/auth/") || path.startsWith("/auth/") || path.startsWith("/api/cron/") || path.startsWith("/design");

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
