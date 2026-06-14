import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type SuperAdminContext = { authUserId: string; appUserId: string; email: string | null };

/**
 * Gate for the platform console. Returns the super-admin context, or null if
 * the caller isn't a platform super admin. The identity check uses the logged-in
 * user's JWT to find their app user; super-admin status is verified via
 * service-role. Cross-tenant data access is ONLY permitted after this passes.
 */
export async function requireSuperAdmin(): Promise<SuperAdminContext | null> {
  const userClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return null;

  const svc = createSupabaseServiceClient();
  const { data: appUser } = await svc.from("users").select("id, email").eq("auth_id", user.id).maybeSingle();
  if (!appUser) return null;

  const { data: sa } = await svc.from("super_admins").select("user_id").eq("user_id", appUser.id).maybeSingle();
  if (!sa) return null;

  return { authUserId: user.id, appUserId: appUser.id, email: appUser.email };
}
