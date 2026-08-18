import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { automationRulesRepo, type TriggerType, type Condition, type Action } from "@/lib/repositories/automationRules";
import { issuesRepo, type Issue } from "@/lib/repositories/issues";
import { issueActivityRepo } from "@/lib/repositories/issueActivity";
import { sprintsRepo } from "@/lib/repositories/sprints";
import { logger } from "@/lib/logger";
import { validateWebhookUrl } from "@/lib/api/ssrfGuard";

type IssueContext = Issue & { projectKey?: string };

function evaluateCondition(cond: Condition, issue: IssueContext): boolean {
  const raw = issue[cond.field as keyof Issue];
  const val = Array.isArray(raw) ? raw : String(raw ?? "");

  switch (cond.operator) {
    case "is":
      return Array.isArray(val) ? val.includes(cond.value ?? "") : val === (cond.value ?? "");
    case "is_not":
      return Array.isArray(val) ? !val.includes(cond.value ?? "") : val !== (cond.value ?? "");
    case "contains":
      return Array.isArray(val) ? val.includes(cond.value ?? "") : val.includes(cond.value ?? "");
    case "is_empty":
      return Array.isArray(val) ? val.length === 0 : !raw;
    default:
      return false;
  }
}

async function runAction(action: Action, issue: IssueContext, tenantId: string): Promise<void> {
  const svc = createSupabaseServiceClient();

  switch (action.type) {
    case "set_priority":
      await issuesRepo(svc).update(tenantId, issue.id, { priority: action.value });
      break;

    case "set_assignee":
      await issuesRepo(svc).update(tenantId, issue.id, { assignee_id: action.value || null });
      break;

    case "add_label": {
      const current: string[] = Array.isArray(issue.labels) ? issue.labels : [];
      if (!current.includes(action.value)) {
        await issuesRepo(svc).update(tenantId, issue.id, { labels: [...current, action.value] });
      }
      break;
    }

    case "post_comment":
      await issueActivityRepo(svc).addComment({
        tenantId,
        issueId: issue.id,
        authorId: null,
        authorLabel: "Forge Automation",
        body: action.value,
        parentId: null,
      });
      break;

    case "move_to_next_sprint": {
      // "Next" = the soonest-starting still-planned sprint in the issue's
      // project — the same rollover a human does by hand after completing a
      // sprint with leftover work. No-op (not an error) if there isn't one
      // yet; nothing to roll into.
      const sprints = await sprintsRepo(svc).listForProject(tenantId, issue.project_id);
      const next = sprints
        .filter((s) => s.status === "planned")
        .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""))[0];
      if (next) {
        await issuesRepo(svc).update(tenantId, issue.id, { sprint_id: next.id });
      }
      break;
    }

    case "fire_webhook": {
      const guard = await validateWebhookUrl(action.value ?? "");
      if (!guard.ok) {
        logger.warn("Automation fire_webhook blocked by SSRF guard", { url: action.value, reason: guard.reason });
        break;
      }
      const payload = JSON.stringify({ event: "automation.fired", data: { issueId: issue.id, issueTitle: issue.title } });
      await fetch(action.value, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);
      break;
    }
  }
}

export async function runAutomations(
  tenantId: string,
  trigger: TriggerType,
  issue: Issue,
): Promise<void> {
  try {
    const svc = createSupabaseServiceClient();
    const rules = await automationRulesRepo(svc).listEnabledForTrigger(tenantId, trigger);
    if (rules.length === 0) return;

    for (const rule of rules) {
      try {
        const allMatch = rule.conditions.every((c) => evaluateCondition(c, issue));
        if (!allMatch) continue;
        for (const action of rule.actions) {
          await runAction(action, issue, tenantId);
        }
      } catch (e) {
        logger.warn("Automation rule failed", { ruleId: rule.id, err: String(e) });
      }
    }
  } catch (e) {
    logger.warn("runAutomations error", { tenantId, trigger, err: String(e) });
  }
}
