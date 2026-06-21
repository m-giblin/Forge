import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- service-role: SSO auto-provision needs to write memberships cross-RLS
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ssoConfigRepo } from "@/lib/repositories/ssoConfig";
import { membersRepo } from "@/lib/repositories/members";

/**
 * OAuth callback — handles the redirect from Google / Microsoft after the user
 * authenticates with their IdP. Exchanges the code for a Supabase session, then:
 *   1. If the user's email domain matches a tenant's SSO config + auto_provision=true,
 *      ensure they have a membership in that tenant (upsert as member).
 *   2. Redirect to `next` (defaults to /).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const email = data.user.email ?? "";
  const domain = email.includes("@") ? email.split("@")[1].toLowerCase() : null;

  if (domain) {
    try {
      const svc = createSupabaseServiceClient();
      const ssoRepo = ssoConfigRepo(svc);
      const ssoMatch = await ssoRepo.getByDomain(domain);

      if (ssoMatch?.auto_provision) {
        // Ensure the user exists in our users table
        const { data: existingUser } = await svc
          .from("users")
          .select("id")
          .eq("auth_id", data.user.id)
          .maybeSingle();

        let appUserId = existingUser?.id;

        if (!appUserId) {
          const { data: newUser } = await svc
            .from("users")
            .insert({ auth_id: data.user.id, email, name: data.user.user_metadata?.full_name ?? null })
            .select("id")
            .single();
          appUserId = newUser?.id;
        }

        // Auto-provision membership (idempotent)
        if (appUserId) {
          await membersRepo(svc).add(ssoMatch.tenant_id, appUserId, "member");
        }
      }
    } catch {
      // Auto-provision is best-effort — never block the auth flow
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
