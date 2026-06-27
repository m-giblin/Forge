import { getTenantContext } from "@/lib/auth";
import { redirect } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- service-role: cross-table estimate accuracy report
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import EstimateAccuracyClient from "./EstimateAccuracyClient";

export type AccuracyIssue = {
  id: string;
  number: number;
  title: string;
  projectId: string;
  projectName: string;
  projectKey: string;
  estimatedMinutes: number;
  loggedMinutes: number;
  varianceMinutes: number;
  variancePct: number;
  accuracyPct: number;
};

export default async function EstimateAccuracyPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const svc = createSupabaseServiceClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffIso = cutoff.toISOString();

  const { data: issueRows } = await svc
    .from("issues")
    .select("id, number, title, project_id, time_estimate_minutes, updated_at")
    .eq("tenant_id", ctx.tenant.id)
    .eq("status", "done")
    .gt("time_estimate_minutes", 0)
    .gte("updated_at", cutoffIso);

  if (!issueRows || issueRows.length === 0) {
    return <EstimateAccuracyClient slug={slug} issues={[]} projects={[]} />;
  }

  const issueIds = issueRows.map((r) => r.id as string);

  const { data: logRows } = await svc
    .from("issue_time_logs")
    .select("issue_id, minutes")
    .eq("tenant_id", ctx.tenant.id)
    .in("issue_id", issueIds);

  const logMap = new Map<string, number>();
  for (const log of logRows ?? []) {
    const id = log.issue_id as string;
    logMap.set(id, (logMap.get(id) ?? 0) + (log.minutes as number));
  }

  const withLogs = issueRows.filter((r) => (logMap.get(r.id as string) ?? 0) > 0);
  if (withLogs.length === 0) {
    return <EstimateAccuracyClient slug={slug} issues={[]} projects={[]} />;
  }

  const projectIds = [...new Set(withLogs.map((r) => r.project_id as string).filter(Boolean))];
  const { data: projRows } = await svc.from("projects").select("id, name, key").in("id", projectIds);
  const projMap = new Map((projRows ?? []).map((p) => [p.id as string, { name: p.name as string, key: p.key as string }]));

  const issues: AccuracyIssue[] = withLogs.map((r) => {
    const logged = logMap.get(r.id as string) ?? 0;
    const estimated = r.time_estimate_minutes as number;
    const variance = logged - estimated;
    const variancePct = Math.round((variance / estimated) * 100);
    const accuracyPct = Math.round(Math.min(estimated, logged) / Math.max(estimated, logged) * 100);
    const proj = projMap.get(r.project_id as string);
    return {
      id: r.id as string,
      number: r.number as number,
      title: r.title as string,
      projectId: r.project_id as string,
      projectName: proj?.name ?? "Unknown",
      projectKey: proj?.key ?? "?",
      estimatedMinutes: estimated,
      loggedMinutes: logged,
      varianceMinutes: variance,
      variancePct,
      accuracyPct,
    };
  }).sort((a, b) => a.accuracyPct - b.accuracyPct);

  const projects = (projRows ?? []).map((p) => ({ id: p.id as string, name: p.name as string, key: p.key as string }));

  return <EstimateAccuracyClient slug={slug} issues={issues} projects={projects} />;
}
