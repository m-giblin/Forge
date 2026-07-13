"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: reads the tenant's own replay attachment from storage (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { issueActivityRepo, type IssueComment } from "@/lib/repositories/issueActivity";
import { summarizeReplay } from "@/lib/services/replaySummary";

const BUCKET = "issue-attachments";

/** FORGE-71 fast-follow: fetch the replay file, ask Grok for a plain-English
 * narrative, and log it as a system comment (same pattern as AI Triage) so
 * it lands in Activity — which is already the first thing a reviewer sees. */
export async function summarizeReplayAction(
  slug: string,
  issueId: string,
  storagePath: string
): Promise<IssueComment> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (!storagePath.startsWith(`${ctx.tenant.id}/`)) throw new Error("Access denied.");

  const svc = createSupabaseServiceClient();
  const { data, error } = await svc.storage.from(BUCKET).download(storagePath);
  if (error || !data) throw new Error("Could not load the replay file.");

  const events = JSON.parse(await data.text());
  if (!Array.isArray(events) || events.length === 0) throw new Error("Replay has no recorded events.");

  const narrative = await summarizeReplay(ctx.tenant.id, events);

  const comment = await issueActivityRepo(svc).addComment({
    tenantId: ctx.tenant.id,
    issueId,
    authorId: null,
    authorLabel: "AI Replay Summary",
    body: `**🎥 Session Replay summary** · ${narrative}`,
  });

  revalidatePath(`/${slug}/issues/${issueId}`);
  return comment;
}

export type ReplayContextBadges = {
  /** e.g. "Started 4 min after deploy v1.42.0 (production)" */
  deployBadge: string | null;
  /** e.g. "Reported by a customer on Acme Corp ($50k ARR)" */
  customerBadge: string | null;
};

// A deploy is only worth flagging if the session started reasonably close
// after it — otherwise "closest deploy" is noise, not a signal.
const DEPLOY_CORRELATION_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** FORGE-71 fast-follow: cheap correlation lookups only Forge can make, since
 * it's also the deploy-history system and the CRM — no standalone
 * session-replay tool has this data to cross-reference. */
export async function getReplayContextBadgesAction(
  slug: string,
  issueId: string,
  storagePath: string
): Promise<ReplayContextBadges> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (!storagePath.startsWith(`${ctx.tenant.id}/`)) throw new Error("Access denied.");

  const svc = createSupabaseServiceClient();
  const badges: ReplayContextBadges = { deployBadge: null, customerBadge: null };

  // Deploy correlation: find the replay's first event timestamp, then the
  // nearest deploy before it, within a window that actually means something.
  const { data: fileData, error: fileError } = await svc.storage.from(BUCKET).download(storagePath);
  if (!fileError && fileData) {
    try {
      const events = JSON.parse(await fileData.text()) as Array<{ timestamp: number }>;
      const first = events[0]?.timestamp;
      if (typeof first === "number") {
        const sessionStart = new Date(first);
        const { data: deploys } = await svc
          .from("deployments")
          .select("version, environment, deployed_at")
          .eq("tenant_id", ctx.tenant.id)
          .lte("deployed_at", sessionStart.toISOString())
          .order("deployed_at", { ascending: false })
          .limit(1);
        const nearest = deploys?.[0];
        if (nearest) {
          const deltaMs = sessionStart.getTime() - new Date(nearest.deployed_at as string).getTime();
          if (deltaMs <= DEPLOY_CORRELATION_WINDOW_MS) {
            const minutes = Math.max(1, Math.round(deltaMs / 60000));
            badges.deployBadge = `Session started ${minutes} min after deploy ${nearest.version} (${nearest.environment})`;
          }
        }
      }
    } catch {
      // Malformed replay JSON — skip deploy correlation, not fatal.
    }
  }

  // Customer correlation: highest-ARR account linked to this issue, if any.
  const { data: links } = await svc
    .from("customer_issue_links")
    .select("customer_accounts(name, tier, arr_usd)")
    .eq("tenant_id", ctx.tenant.id)
    .eq("issue_id", issueId);
  const accounts = (links ?? [])
    .map((l) => (Array.isArray(l.customer_accounts) ? l.customer_accounts[0] : l.customer_accounts))
    .filter((a): a is { name: string; tier: string | null; arr_usd: number | null } => !!a)
    .sort((a, b) => (b.arr_usd ?? 0) - (a.arr_usd ?? 0));
  const top = accounts[0];
  if (top) {
    const arrLabel = top.arr_usd ? ` ($${Math.round(top.arr_usd / 100).toLocaleString()} ARR)` : "";
    badges.customerBadge = `Linked to ${top.name}${arrLabel}`;
  }

  return badges;
}
