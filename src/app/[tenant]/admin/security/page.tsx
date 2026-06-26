import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- admin security dashboard: requires service-role to read all members + keys
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import SecurityDashboard from "./SecurityDashboard";

export const revalidate = 300;

export default async function SecurityPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();
  const tenantId = ctx.tenant.id;

  const [membersRes, apiKeysRes, ssoRes, complianceRes] = await Promise.all([
    svc
      .from("memberships")
      .select("role, created_at, users(email, created_at)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    svc
      .from("api_keys")
      .select("id, name, key_prefix, scopes, last_used_at, revoked_at, expires_at, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    svc
      .from("tenant_sso_config")
      .select("provider, updated_at")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    svc
      .from("compliance_requests")
      .select("id, status, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const members = (membersRes.data ?? []) as unknown as Array<{
    role: string;
    created_at: string;
    users: { email: string; created_at: string } | null;
  }>;

  const apiKeys = (apiKeysRes.data ?? []) as Array<{
    id: string;
    name: string;
    key_prefix: string;
    scopes: string[];
    last_used_at: string | null;
    revoked_at: string | null;
    expires_at: string | null;
    created_at: string;
  }>;

  const ssoConfig = ssoRes.data as { provider: string; updated_at: string } | null;
  const complianceRequests = (complianceRes.data ?? []) as Array<{ id: string; status: string; created_at: string }>;

  // Compute security signals
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;

  const activeKeys = apiKeys.filter((k) => !k.revoked_at && (!k.expires_at || new Date(k.expires_at).getTime() > now));
  const staleKeys = activeKeys.filter(
    (k) => !k.last_used_at || now - new Date(k.last_used_at).getTime() > ninetyDays
  );
  const expiringKeys = activeKeys.filter((k) => {
    if (!k.expires_at) return false;
    const expiresIn = new Date(k.expires_at).getTime() - now;
    return expiresIn > 0 && expiresIn < thirtyDays;
  });

  const owners = members.filter((m) => m.role === "owner");
  const admins = members.filter((m) => m.role === "admin");
  const recentMembers = members.filter(
    (m) => now - new Date(m.created_at).getTime() < thirtyDays
  );

  const openCompliance = complianceRequests.filter((r) => r.status !== "resolved");

  const securityScore = Math.max(
    0,
    100 -
      staleKeys.length * 10 -
      expiringKeys.length * 5 -
      (owners.length > 3 ? (owners.length - 3) * 5 : 0) -
      openCompliance.length * 3 -
      (ssoConfig ? 0 : 15)
  );

  return (
    <SecurityDashboard
      members={members}
      apiKeys={apiKeys}
      activeKeys={activeKeys}
      staleKeys={staleKeys}
      expiringKeys={expiringKeys}
      owners={owners}
      admins={admins}
      recentMembers={recentMembers}
      ssoConfig={ssoConfig}
      openCompliance={openCompliance}
      complianceRequests={complianceRequests}
      securityScore={securityScore}
      slug={slug}
    />
  );
}
