import "server-only";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { readImpersonation } from "@/lib/impersonation";
import { requireSuperAdmin } from "@/lib/super-admin";
import { getIpAllowlist, isIpAllowed, extractClientIp } from "@/lib/services/ipAllowlist";
import { loadPermissionDefaults } from "@/lib/services/permissionDefaults";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PermissionOverrides } from "@/lib/permissions";

export type TenantMembership = {
  role: "owner" | "admin" | "member" | "viewer";
  tenant: { id: string; name: string; slug: string };
};

export type SessionContext = {
  authUser: { id: string; email: string | undefined };
  appUserId: string;
  isSuperAdmin: boolean;
  memberships: TenantMembership[];
};

/**
 * The current user's application id (users.id). NOTE: memberships must always
 * be filtered by this — the `memberships_select` RLS policy scopes to "rows in
 * my tenants", NOT "my own rows", so a member can read co-members' rows.
 * Relying on RLS alone returns multiple rows. Returns null if no users row yet.
 */
async function currentAppUserId(supabase: SupabaseClient, authId: string): Promise<string | null> {
  const { data } = await supabase.from("users").select("id").eq("auth_id", authId).maybeSingle();
  return data?.id ?? null;
}

/**
 * Resolve the current human session: the authenticated user plus the tenants
 * they belong to. Returns null when not signed in.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const appUserId = await currentAppUserId(supabase, user.id);
  if (!appUserId)
    return { authUser: { id: user.id, email: user.email }, appUserId: "", isSuperAdmin: false, memberships: [] };

  const [membershipsRes, superAdminRes] = await Promise.all([
    supabase
      .from("memberships")
      .select("role, tenant:tenants(id, name, slug)")
      .eq("user_id", appUserId) // scope to THIS user (see note on RLS above)
      .order("created_at", { ascending: true }),
    // super_admins_self RLS lets a user read only their own row.
    supabase.from("super_admins").select("user_id").eq("user_id", appUserId).maybeSingle(),
  ]);
  if (superAdminRes.error) throw superAdminRes.error;
  if (membershipsRes.error) throw membershipsRes.error;

  const memberships = (membershipsRes.data ?? []).map((m) => ({
    role: m.role,
    tenant: Array.isArray(m.tenant) ? m.tenant[0] : m.tenant,
  })) as TenantMembership[];

  return {
    authUser: { id: user.id, email: user.email },
    appUserId,
    isSuperAdmin: !!superAdminRes.data,
    memberships,
  };
}

export type TenantContext = {
  tenant: { id: string; name: string; slug: string };
  role: TenantMembership["role"];
  appUserId: string;
  email: string | null; // actor label for audit/governance stamping
  impersonating: boolean;
  permissionOverrides: PermissionOverrides;
  customRolePermissions: import("@/lib/rbac").RbacPermissionSet | null;
  permissionDefaults: import("@/lib/rbac").PermissionDefaults;
};

/**
 * Resolve a tenant the current user belongs to, by slug. Returns null if the
 * user isn't a member. Use to authorize and scope tenant workspace pages.
 */
export async function getTenantContext(slug: string): Promise<TenantContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const appUserId = await currentAppUserId(supabase, user.id);
  if (!appUserId) return null;

  // Member path: RLS only returns the tenant if the user belongs to it.
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug, permission_overrides")
    .eq("slug", slug)
    .maybeSingle();

  if (tenant) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("role, custom_role_id")
      .eq("tenant_id", tenant.id)
      .eq("user_id", appUserId) // scope to THIS user — unique per (tenant,user)
      .maybeSingle();
    if (membership) {
      // IP allowlist check — owners always bypass so they can never lock themselves out.
      if (membership.role !== "owner") {
        const allowlist = await getIpAllowlist(tenant.id);
        if (allowlist.length > 0) {
          const reqHeaders = await headers();
          const clientIp = extractClientIp(reqHeaders);
          if (!clientIp || !isIpAllowed(clientIp, allowlist)) return null;
        }
      }

      let customRolePermissions: import("@/lib/rbac").RbacPermissionSet | null = null;
      if (membership.custom_role_id) {
        const { data: cr } = await supabase
          .from("custom_roles")
          .select("permissions")
          .eq("id", membership.custom_role_id)
          .eq("tenant_id", tenant.id)
          .maybeSingle();
        customRolePermissions = (cr?.permissions as import("@/lib/rbac").RbacPermissionSet) ?? null;
      }
      const permissionDefaults = await loadPermissionDefaults();
      return {
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        role: membership.role as TenantContext["role"],
        appUserId,
        email: user.email ?? null,
        impersonating: false,
        permissionOverrides: (tenant.permission_overrides ?? {}) as PermissionOverrides,
        customRolePermissions,
        permissionDefaults,
      };
    }
  }

  // Impersonation path: the super admin is NOT a member, so RLS hid the tenant
  // above. Resolve it via service-role, gated by a valid signed cookie + an
  // active super-admin identity. Read-only (viewer).
  const imp = await readImpersonation();
  if (imp && (await requireSuperAdmin())) {
    const svc = createSupabaseServiceClient();
    const { data: t } = await svc.from("tenants").select("id, name, slug, permission_overrides").eq("slug", slug).maybeSingle();
    if (t && imp.tenantId === t.id) {
      return { tenant: { id: t.id, name: t.name, slug: t.slug }, role: "viewer", appUserId, email: user.email ?? null, impersonating: true, permissionOverrides: (t.permission_overrides ?? {}) as PermissionOverrides, customRolePermissions: null, permissionDefaults: await loadPermissionDefaults() };
    }
  }

  return null;
}
