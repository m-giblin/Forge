import "server-only";
// eslint-disable-next-line no-restricted-imports -- service-role: SLA cron needs cross-tenant access (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { slaPoliciesRepo, type SlaPolicy, type SlaTier } from "@/lib/repositories/slaPolicies";
import { notifyChat } from "@/lib/services/chatNotifications";
import type { Issue } from "@/lib/repositories/issues";

export type SlaStatus = "ok" | "warning" | "breach" | "none";

export type SlaTimer = {
  status: SlaStatus;
  label: string;
  hoursRemaining: number | null;
  policyName: string | null;
};

function issueMatchesPolicy(issue: Issue, policy: SlaPolicy): boolean {
  const cond = policy.conditions;
  if (cond.priority && cond.priority.length > 0) {
    if (!cond.priority.includes(issue.priority)) return false;
  }
  return true;
}

function hoursElapsed(from: string): number {
  return (Date.now() - new Date(from).getTime()) / 3_600_000;
}

export function computeSlaTimer(issue: Issue, policies: SlaPolicy[]): SlaTimer {
  const matching = policies.filter((p) => issueMatchesPolicy(issue, p));
  if (matching.length === 0) return { status: "none", label: "", hoursRemaining: null, policyName: null };

  const policy = matching[0];
  const elapsed = hoursElapsed(issue.created_at as string);

  // Find the response tier (time to first assignment)
  const responseTier = policy.tiers.find((t) => t.type === "response");
  const resolutionTier = policy.tiers.find((t) => t.type === "resolution");

  // Check response SLA if not yet assigned
  if (!issue.assignee_id && responseTier) {
    const remaining = responseTier.hours - elapsed;
    if (remaining <= 0) {
      return { status: "breach", label: `${Math.round(-remaining)}h overdue`, hoursRemaining: remaining, policyName: policy.name };
    }
    const pct = elapsed / responseTier.hours;
    return {
      status: pct >= 0.75 ? "warning" : "ok",
      label: `${Math.round(remaining)}h to assign`,
      hoursRemaining: remaining,
      policyName: policy.name,
    };
  }

  // Check resolution SLA
  if (resolutionTier && !["done", "closed"].includes(issue.status)) {
    const remaining = resolutionTier.hours - elapsed;
    if (remaining <= 0) {
      return { status: "breach", label: `${Math.round(-remaining)}h overdue`, hoursRemaining: remaining, policyName: policy.name };
    }
    const pct = elapsed / resolutionTier.hours;
    return {
      status: pct >= 0.75 ? "warning" : "ok",
      label: `${Math.round(remaining)}h to resolve`,
      hoursRemaining: remaining,
      policyName: policy.name,
    };
  }

  return { status: "ok", label: "SLA met", hoursRemaining: null, policyName: policy.name };
}

// Called by the cron job — runs for a single tenant
export async function runSlaCron(tenantId: string): Promise<void> {
  const svc = createSupabaseServiceClient();
  const repo = slaPoliciesRepo(svc);

  const policies = await repo.listEnabled(tenantId);
  if (policies.length === 0) return;

  // Load open issues for this tenant
  const { data: issues } = await svc
    .from("issues")
    .select("*")
    .eq("tenant_id", tenantId)
    .not("status", "in", '("done","closed")')
    .order("created_at", { ascending: true });

  if (!issues?.length) return;

  const { data: tenant } = await svc.from("tenants").select("slug").eq("id", tenantId).maybeSingle();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";

  for (const issue of issues) {
    for (const policy of policies) {
      if (!issueMatchesPolicy(issue as Issue, policy)) continue;
      const elapsed = hoursElapsed(issue.created_at as string);

      for (const tier of policy.tiers as SlaTier[]) {
        const eventType = tier.type === "response" ? "response_breach" : "resolution_breach";

        // Skip response breach if already assigned
        if (tier.type === "response" && issue.assignee_id) continue;
        // Skip resolution breach if done
        if (tier.type === "resolution" && ["done", "closed"].includes(issue.status)) continue;

        if (elapsed >= tier.hours) {
          // Check if we already fired this event
          const { count } = await svc
            .from("sla_events")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .eq("issue_id", issue.id)
            .eq("policy_id", policy.id)
            .eq("event_type", eventType)
            .eq("tier_hours", tier.hours);

          if ((count ?? 0) > 0) continue; // already fired

          await repo.insertEvent({
            tenant_id: tenantId,
            issue_id: issue.id,
            policy_id: policy.id,
            event_type: eventType,
            tier_hours: tier.hours,
          });

          const { data: proj } = await svc.from("projects").select("key").eq("id", issue.project_id).maybeSingle();
          const issueKey = proj ? `${proj.key}-${issue.number}` : `#${issue.number}`;
          const issueUrl = `${baseUrl}/${tenant?.slug ?? tenantId}/issues/${issue.id}`;
          const overdue = Math.round(elapsed - tier.hours);

          void notifyChat(tenantId, {
            event: "sla_breach" as "created",
            issueKey,
            issueTitle: issue.title,
            issueUrl,
            status: issue.status,
            priority: issue.priority,
            commentBody: `SLA breach (${policy.name}): ${tier.type} SLA of ${tier.hours}h exceeded by ${overdue}h`,
          });

          // Post comment to issue timeline
          await svc.from("issue_comments").insert({
            tenant_id: tenantId,
            issue_id: issue.id,
            author_id: null,
            author_label: "SLA Engine",
            body: `⚠️ SLA breach: **${policy.name}** — ${tier.type} SLA of ${tier.hours}h exceeded by ${overdue}h.`,
            parent_id: null,
          });
        }
      }
    }
  }
}
