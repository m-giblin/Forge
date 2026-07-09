import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type DoraMetrics = {
  deploymentsPerWeek: number | null;
  changeFailureRatePct: number | null;
  mttrHours: number | null;
  leadTimeHours: number | null;
  totalDeployments: number;
  windowDays: number;
};

const MS_HOUR = 1000 * 60 * 60;

/**
 * Computes the real DORA four keys from deployments + code_events — no
 * sample data, no Preview badge. Any metric this tenant doesn't have enough
 * data for comes back null (not zero, not a fabricated placeholder) so the
 * UI can show "—" honestly rather than a number that looks real but isn't.
 */
export async function computeDoraMetrics(tenantId: string, windowDays = 30): Promise<DoraMetrics> {
  const svc = createSupabaseServiceClient();
  const since = new Date(Date.now() - windowDays * 24 * MS_HOUR).toISOString();

  const { data: deploysRaw } = await svc
    .from("deployments")
    .select("status, deployed_at, commit_sha, repo_full_name, environment")
    .eq("tenant_id", tenantId)
    .gte("deployed_at", since)
    .order("deployed_at", { ascending: true });

  const deploys = (deploysRaw ?? []) as {
    status: string; deployed_at: string; commit_sha: string | null;
    repo_full_name: string | null; environment: string;
  }[];

  if (deploys.length === 0) {
    return { deploymentsPerWeek: null, changeFailureRatePct: null, mttrHours: null, leadTimeHours: null, totalDeployments: 0, windowDays };
  }

  // 1. Deployment frequency — successful deploys per week over the window.
  const successCount = deploys.filter((d) => d.status === "success").length;
  const deploymentsPerWeek = Math.round((successCount / (windowDays / 7)) * 10) / 10;

  // 2. Change failure rate — % of deploys in the window that failed.
  const failureCount = deploys.filter((d) => d.status === "failure").length;
  const changeFailureRatePct = Math.round((failureCount / deploys.length) * 1000) / 10;

  // 3. MTTR — for each failed deploy, time until the next successful deploy
  // to the same environment. Deploys already sorted ascending by time.
  const mttrSamples: number[] = [];
  for (let i = 0; i < deploys.length; i++) {
    if (deploys[i].status !== "failure") continue;
    const next = deploys.slice(i + 1).find((d) => d.status === "success" && d.environment === deploys[i].environment);
    if (next) {
      const hours = (new Date(next.deployed_at).getTime() - new Date(deploys[i].deployed_at).getTime()) / MS_HOUR;
      if (hours >= 0) mttrSamples.push(hours);
    }
  }
  const mttrHours = mttrSamples.length
    ? Math.round((mttrSamples.reduce((s, h) => s + h, 0) / mttrSamples.length) * 10) / 10
    : null;

  // 4. Lead time for changes — time from PR merge to the deploy that shipped it,
  // matched by commit SHA against code_events (kind = pr_merged).
  const shas = deploys.map((d) => d.commit_sha).filter((s): s is string => !!s);
  let leadTimeHours: number | null = null;
  if (shas.length > 0) {
    const { data: mergeEventsRaw } = await svc
      .from("code_events")
      .select("sha, occurred_at")
      .eq("tenant_id", tenantId)
      .eq("kind", "pr_merged")
      .in("sha", shas);

    const mergedAtBySha = new Map(
      ((mergeEventsRaw ?? []) as { sha: string; occurred_at: string }[]).map((e) => [e.sha, e.occurred_at])
    );

    const leadSamples: number[] = [];
    for (const d of deploys) {
      if (!d.commit_sha || d.status !== "success") continue;
      const mergedAt = mergedAtBySha.get(d.commit_sha);
      if (!mergedAt) continue;
      const hours = (new Date(d.deployed_at).getTime() - new Date(mergedAt).getTime()) / MS_HOUR;
      if (hours >= 0) leadSamples.push(hours);
    }
    if (leadSamples.length > 0) {
      leadTimeHours = Math.round((leadSamples.reduce((s, h) => s + h, 0) / leadSamples.length) * 10) / 10;
    }
  }

  return {
    deploymentsPerWeek,
    changeFailureRatePct,
    mttrHours,
    leadTimeHours,
    totalDeployments: deploys.length,
    windowDays,
  };
}
