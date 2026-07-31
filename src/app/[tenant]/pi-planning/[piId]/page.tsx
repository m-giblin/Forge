import { redirect, notFound } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { getPiCycle, listPiObjectives, listPiVotes } from "@/lib/services/piPlanning";
import { listMembers } from "@/lib/services/members";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import PiCycleDetail from "./PiCycleDetail";

export default async function PiCycleDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; piId: string }>;
}) {
  const { tenant: slug, piId } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (ctx.role === "viewer") redirect(`/${slug}/board`);

  const cycle = await getPiCycle(ctx.tenant.id, piId);
  if (!cycle) notFound();

  const svc = createSupabaseServiceClient();
  const [objectives, members, projectRows] = await Promise.all([
    listPiObjectives(cycle.id),
    listMembers(ctx.tenant.id, ctx.impersonating),
    svc.from("projects").select("id, key, name").eq("tenant_id", ctx.tenant.id).not("status", "eq", "archived"),
  ]);

  const votes = await listPiVotes(ctx.tenant.id, objectives.map((o) => o.id));

  return (
    <main className="w-full px-6 py-8">
      <PiCycleDetail
        slug={slug}
        meUserId={ctx.appUserId}
        cycle={{ id: cycle.id, name: cycle.name, startDate: cycle.startDate, endDate: cycle.endDate, status: cycle.status }}
        projects={((projectRows.data ?? []) as { id: string; key: string; name: string }[])}
        members={members.map((m) => ({ userId: m.userId, label: m.name || m.email }))}
        objectives={objectives.map((o) => ({ id: o.id, title: o.title, description: o.description, projectId: o.projectId }))}
        votes={votes.map((v) => ({ objectiveId: v.objectiveId, userId: v.userId, score: v.score }))}
      />
    </main>
  );
}
