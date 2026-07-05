import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { gitIntegrationRepo } from "@/lib/repositories/gitIntegration";
import { issuesRepo } from "@/lib/repositories/issues";
import { projectsRepo } from "@/lib/repositories/projects";
import { logger } from "@/lib/logger";

// Parse issue keys like FORGE-123, WEB-42 from text
const KEY_RE = /\b([A-Z]{2,10}-\d+)\b/g;
// Closing keywords that trigger auto-close on PR merge
const CLOSE_RE = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+(?:#|([A-Z]{2,10}-))?(\d+)/gi;

function extractIssueKeys(text: string): string[] {
  return [...new Set([...(text.matchAll(KEY_RE) ?? [])].map((m) => m[1]))];
}

function extractClosingKeys(text: string): string[] {
  const keys: string[] = [];
  for (const m of text.matchAll(CLOSE_RE)) {
    if (m[1] && m[2]) keys.push(`${m[1]}${m[2]}`);
  }
  // Also catch full-key pattern after close keywords
  const closeSection = text.replace(/\n/g, " ");
  const closeMatch = closeSection.match(/(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+([A-Z]{2,10}-\d+)/gi) ?? [];
  for (const m of closeMatch) {
    const key = m.match(/([A-Z]{2,10}-\d+)/)?.[1];
    if (key) keys.push(key);
  }
  return [...new Set(keys)];
}

async function resolveIssueByKey(svc: ReturnType<typeof createSupabaseServiceClient>, tenantId: string, key: string) {
  const parts = key.match(/^([A-Z]{2,10})-(\d+)$/);
  if (!parts) return null;
  const [, projectKey, num] = parts;
  const project = await projectsRepo(svc).listByTenant(tenantId).then((ps) => ps.find((p) => p.key === projectKey));
  if (!project) return null;
  const { data } = await svc.from("issues").select("id, status").eq("tenant_id", tenantId).eq("project_id", project.id).eq("number", parseInt(num)).maybeSingle();
  return data ?? null;
}

export async function handleGithubWebhook(
  tenantId: string,
  connectionId: string,
  eventType: string,
  deliveryId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
): Promise<void> {
  const svc = createSupabaseServiceClient();
  const repo = gitIntegrationRepo(svc);

  try {
    if (eventType === "pull_request") {
      const pr = payload.pull_request;
      if (!pr) return;
      const repoFullName: string = payload.repository?.full_name ?? "";
      const action: string = payload.action ?? "";
      const prNumber: number = pr.number;
      const prTitle: string = pr.title ?? "";
      const prBody: string = pr.body ?? "";
      const prUrl: string = pr.html_url ?? "";
      const isMerged = action === "closed" && pr.merged === true;
      const prState = isMerged ? "merged" : action === "closed" ? "closed" : "open";
      const occurredAt: string = pr.updated_at ?? new Date().toISOString();
      const actorLogin: string = payload.sender?.login ?? "";
      const kind = isMerged ? "pr_merged" : action === "opened" ? "pr_opened" : action === "closed" ? "pr_closed" : "pr_updated";

      await repo.insertCodeEvent({
        tenantId, connectionId, repoFullName, kind,
        externalId: deliveryId, prNumber, sha: pr.merge_commit_sha ?? null,
        branch: pr.head?.ref ?? null, actorLogin, occurredAt, payload,
      });

      // Find linked issue keys from PR title + body
      const combined = `${prTitle} ${prBody}`;
      const allKeys = extractIssueKeys(combined);
      const closingKeys = isMerged ? extractClosingKeys(combined) : [];

      for (const key of allKeys) {
        const issue = await resolveIssueByKey(svc, tenantId, key);
        if (!issue) continue;

        await repo.upsertCodeLink(tenantId, {
          tenantId, issueId: issue.id, connectionId, repoFullName,
          prNumber, linkKind: "ref", prState, prTitle, prUrl,
        });

        // Auto-close on merge if closing keyword used
        if (isMerged && (closingKeys.includes(key) || closingKeys.length === 0 && allKeys.length === 1)) {
          if (issue.status !== "done") {
            await issuesRepo(svc).update(tenantId, issue.id, { status: "done" });
            logger.info("Auto-closed issue on PR merge", { tenantId, issueId: issue.id, key });
          }
        }
      }
    } else if (eventType === "push") {
      const commits: Array<{ id: string; message: string; url: string; author?: { name: string } }> = payload.commits ?? [];
      const repoFullName: string = payload.repository?.full_name ?? "";
      const branch: string = (payload.ref ?? "").replace("refs/heads/", "");

      for (const commit of commits) {
        await repo.insertCodeEvent({
          tenantId, connectionId, repoFullName, kind: "commit",
          externalId: commit.id, prNumber: null, sha: commit.id,
          branch, actorLogin: commit.author?.name ?? null,
          occurredAt: new Date().toISOString(), payload: commit,
        });
      }
    } else if (eventType === "release" || eventType === "create") {
      // GitHub release published or tag pushed — record as a deployment.
      const repoFullName: string = payload.repository?.full_name ?? "";
      const actorLogin: string = payload.sender?.login ?? "";
      let version: string | null = null;
      let sha: string | null = null;

      if (eventType === "release" && payload.action === "published") {
        version = payload.release?.tag_name ?? null;
        sha = payload.release?.target_commitish ?? null;
      } else if (eventType === "create" && payload.ref_type === "tag") {
        version = payload.ref ?? null;
      }

      if (version) {
        const svc = createSupabaseServiceClient();
        await svc.from("deployments").insert({
          tenant_id: tenantId,
          connection_id: connectionId,
          environment: "production",
          version,
          repo_full_name: repoFullName,
          deployed_by: actorLogin,
          status: "success",
          commit_sha: sha,
          commit_url: sha ? `https://github.com/${repoFullName}/commit/${sha}` : null,
        });
        logger.info("Deployment recorded", { tenantId, version, repoFullName });
      }
    } else if (eventType === "deployment_status") {
      // GitHub Deployments API — update or insert a deployment record.
      const deploymentStatus = payload.deployment_status;
      const deployment = payload.deployment;
      const repoFullName: string = payload.repository?.full_name ?? "";
      if (!deploymentStatus || !deployment) return;

      const state: string = deploymentStatus.state ?? "unknown"; // success | failure | in_progress
      const environment: string = deployment.environment ?? "production";
      const version: string = deployment.ref ?? deployment.sha?.slice(0, 8) ?? "unknown";
      const sha: string = deployment.sha ?? "";
      const actorLogin: string = payload.sender?.login ?? "";

      const svc = createSupabaseServiceClient();
      await svc.from("deployments").upsert({
        tenant_id: tenantId,
        connection_id: connectionId,
        environment,
        version,
        repo_full_name: repoFullName,
        deployed_by: actorLogin,
        status: state === "success" ? "success" : state === "failure" ? "failure" : "in_progress",
        commit_sha: sha,
        deployed_at: deploymentStatus.created_at ?? new Date().toISOString(),
      }, { onConflict: "tenant_id,environment,version,repo_full_name", ignoreDuplicates: false });
    }
  } catch (e) {
    logger.warn("Git webhook processing error", { tenantId, eventType, err: String(e) });
  }
}
