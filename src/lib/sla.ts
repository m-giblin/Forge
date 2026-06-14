// Unassigned-ticket SLA. The founder's rule: an unassigned ticket is fine
// briefly, but must be flagged if it stays unassigned past a threshold —
// 30 minutes for urgent, 2 hours otherwise. Apps/UAT can file without knowing
// who to assign; this surfaces the ones that have waited too long.
//
// Pure + isomorphic so the same logic runs on the server (counts/alerts) and in
// the client (badges). No notification channel exists yet, so "flag" = in-app.

const THRESHOLD_MS: Record<string, number> = {
  urgent: 30 * 60_000, // 30 min
};
const DEFAULT_THRESHOLD_MS = 2 * 60 * 60_000; // 2 hr

export function unassignedThresholdMs(priority: string): number {
  return THRESHOLD_MS[priority] ?? DEFAULT_THRESHOLD_MS;
}

/** Is this issue unassigned and past its grace period? `done` issues never flag. */
export function isUnassignedOverdue(
  issue: { assignee_id: string | null; priority: string; status: string; created_at: string },
  now: number = Date.now()
): boolean {
  if (issue.assignee_id) return false;
  if (issue.status === "done") return false;
  const age = now - new Date(issue.created_at).getTime();
  return age >= unassignedThresholdMs(issue.priority);
}
