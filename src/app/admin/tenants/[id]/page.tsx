import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/super-admin";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { platformRepo } from "@/lib/repositories/platform";
import { adminStyles as S } from "../../page";
import TenantDetailClient from "./TenantDetailClient";

function healthScore(t: { member_count: number; issue_count: number; status: string }) {
  let score = 0;
  if (t.status === "active") score += 25;
  if (t.member_count >= 2) score += 25;
  else if (t.member_count === 1) score += 10;
  if (t.issue_count >= 10) score += 30;
  else if (t.issue_count >= 3) score += 20;
  else if (t.issue_count >= 1) score += 10;
  if (t.member_count > 0 && t.issue_count > 0) score += 20;
  return Math.min(score, 100);
}

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const sa = await requireSuperAdmin();
  if (!sa) redirect("/");

  const { id } = await params;
  const svc = createSupabaseServiceClient();
  const repo = platformRepo(svc);

  // Fetch tenant row
  const { data: tenant } = await svc
    .from("tenants")
    .select("id, name, slug, status, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!tenant) notFound();

  // Fetch member count + issue count
  const [{ count: memberCount }, { count: issueCount }] = await Promise.all([
    svc.from("memberships").select("id", { count: "exact", head: true }).eq("tenant_id", id),
    svc.from("issues").select("id", { count: "exact", head: true }).eq("tenant_id", id),
  ]);

  // Fetch members with emails
  const { data: membersRaw } = await svc
    .from("memberships")
    .select("id, role, created_at, user:user_id(id, email, name)")
    .eq("tenant_id", id)
    .order("created_at", { ascending: true });

  // Fetch feature flag overrides for this tenant
  const { data: overridesRaw } = await svc
    .from("tenant_feature_overrides")
    .select("key, enabled")
    .eq("tenant_id", id);

  // Fetch global flags
  const { data: globalFlags } = await svc
    .from("feature_flags")
    .select("key, enabled");

  // Fetch audit for this tenant
  const auditRows = await repo.listAuditByTenant(id, 30);

  const t = {
    id: tenant.id as string,
    name: tenant.name as string,
    slug: tenant.slug as string,
    status: tenant.status as "active" | "suspended",
    created_at: tenant.created_at as string,
    member_count: memberCount ?? 0,
    issue_count: issueCount ?? 0,
    plan: "premium" as string,
  };

  const health = healthScore(t);

  type Member = { id: string; role: string; email: string; name: string; joinedAt: string };
  const members: Member[] = (membersRaw ?? []).map((m) => {
    const u = Array.isArray(m.user) ? m.user[0] : m.user;
    return {
      id: m.id as string,
      role: m.role as string,
      email: (u as { email?: string } | null)?.email ?? "—",
      name: (u as { name?: string } | null)?.name ?? "—",
      joinedAt: m.created_at as string,
    };
  });

  const overrides: Record<string, boolean> = {};
  for (const o of overridesRaw ?? []) overrides[o.key as string] = o.enabled as boolean;

  const globalMap: Record<string, boolean> = {};
  for (const f of globalFlags ?? []) globalMap[f.key as string] = f.enabled as boolean;

  type AuditEntry = { id: string; action: string; target: string | null; actor: string | null; created_at: string };
  const audit: AuditEntry[] = auditRows.map((r) => {
    const actor = Array.isArray(r.actor) ? r.actor[0] : r.actor;
    return {
      id: r.id,
      action: r.action,
      target: r.target,
      actor: r.actor_label ?? (actor as { email?: string } | null)?.email ?? "system",
      created_at: r.created_at,
    };
  });

  return (
    <main style={{ padding: "24px 28px", maxWidth: 1100 }}>
      <Link href="/admin/tenants" style={S.backLink}>← All Tenants</Link>
      <TenantDetailClient
        tenant={t}
        health={health}
        members={members}
        overrides={overrides}
        globalFlags={globalMap}
        audit={audit}
      />
    </main>
  );
}
