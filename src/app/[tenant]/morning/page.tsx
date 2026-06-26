import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { loadMorningBriefing } from "@/lib/services/morningBriefing";
import { listMembers } from "@/lib/services/members";
// eslint-disable-next-line no-restricted-imports -- service-role required for risk gates read
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { issueRiskGatesRepo, type RiskGateWithIssue } from "@/lib/repositories/issueRiskGates";
import MorningClient from "./MorningClient";

export default async function MorningPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const svc = createSupabaseServiceClient();
  const [briefing, members, openGates, staleGates, mediumRiskIssues] = await Promise.all([
    loadMorningBriefing({ tenantId: ctx.tenant.id, appUserId: ctx.appUserId }),
    listMembers(ctx.tenant.id, ctx.impersonating),
    issueRiskGatesRepo(svc).listOpenGates(ctx.tenant.id),
    issueRiskGatesRepo(svc).listStaleOpenGates(ctx.tenant.id, 24),
    svc
      .from("issues")
      .select("id, number, title, projects!inner(key)")
      .eq("tenant_id", ctx.tenant.id)
      .neq("status", "done")
      .filter("latest_pr_impact->>risk", "eq", "medium")
      .order("updated_at", { ascending: false })
      .limit(10)
      .then((r) => (r.data ?? []) as unknown as { id: string; number: number; title: string; projects: { key: string } }[]),
  ]);

  const userName = members.find((m) => m.userId === ctx.appUserId)?.name ?? ctx.email ?? "there";
  const firstName = userName.split(" ")[0];
  const staleGateIds = new Set(staleGates.map((g) => g.id));

  return (
    <MorningClient
      slug={slug}
      role={ctx.role}
      firstName={firstName}
      briefing={briefing}
      openGates={openGates}
      staleGateIds={staleGateIds}
      mediumRiskIssues={mediumRiskIssues}
    />
  );
}
