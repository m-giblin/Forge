import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type ProjectBudgetStatus = {
  budgetCents: number | null;
  spendCents: number;
  timeValueCents: number;
  totalBurnCents: number;
  pct: number;
  thresholdPct: number | null;
  overThreshold: boolean;
};

export async function getProjectBudgetStatus(
  tenantId: string,
  projectId: string,
): Promise<ProjectBudgetStatus> {
  const svc = createSupabaseServiceClient();

  const [projectRes, spendRes, issuesRes] = await Promise.all([
    svc
      .from("projects")
      .select("budget_cents, budget_alert_threshold_pct")
      .eq("tenant_id", tenantId)
      .eq("id", projectId)
      .maybeSingle(),
    svc
      .from("project_spend")
      .select("amount_cents")
      .eq("tenant_id", tenantId)
      .eq("project_id", projectId),
    svc
      .from("issues")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("project_id", projectId),
  ]);

  const budgetCents = projectRes.data?.budget_cents ?? null;
  const thresholdPct = projectRes.data?.budget_alert_threshold_pct ?? null;

  const spendCents = (spendRes.data ?? []).reduce(
    (s, r) => s + (r.amount_cents as number),
    0,
  );

  const issueIds = (issuesRes.data ?? []).map((r) => r.id as string);

  let timeValueCents = 0;
  if (issueIds.length > 0) {
    const logsRes = await svc
      .from("issue_time_logs")
      .select("user_id, minutes")
      .eq("tenant_id", tenantId)
      .in("issue_id", issueIds);

    const logs = logsRes.data ?? [];
    if (logs.length > 0) {
      const uniqueUserIds = [...new Set(logs.map((l) => l.user_id as string))];

      const ratesRes = await svc
        .from("billing_rates")
        .select("user_id, project_id, role_name, rate_cents")
        .eq("tenant_id", tenantId)
        .or(`user_id.in.(${uniqueUserIds.join(",")}),user_id.is.null`)
        .order("effective_from", { ascending: false });

      const rates = ratesRes.data ?? [];

      function rateForUser(userId: string): number {
        const byUserAndProject = rates.find(
          (r) => r.user_id === userId && r.project_id === projectId,
        );
        if (byUserAndProject) return byUserAndProject.rate_cents as number;

        const byUser = rates.find(
          (r) => r.user_id === userId && !r.project_id,
        );
        if (byUser) return byUser.rate_cents as number;

        const byProject = rates.find(
          (r) => !r.user_id && r.project_id === projectId,
        );
        if (byProject) return byProject.rate_cents as number;

        const generic = rates.find((r) => !r.user_id && !r.project_id);
        if (generic) return generic.rate_cents as number;

        return 0;
      }

      for (const log of logs) {
        const rate = rateForUser(log.user_id as string);
        timeValueCents += Math.round((log.minutes as number) * rate / 60);
      }
    }
  }

  const totalBurnCents = spendCents + timeValueCents;
  const pct =
    budgetCents && budgetCents > 0
      ? Math.round((totalBurnCents / budgetCents) * 100)
      : 0;

  const overThreshold =
    thresholdPct != null && budgetCents != null && pct >= thresholdPct;

  return {
    budgetCents,
    spendCents,
    timeValueCents,
    totalBurnCents,
    pct,
    thresholdPct,
    overThreshold,
  };
}
