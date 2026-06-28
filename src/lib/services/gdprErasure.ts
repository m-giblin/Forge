import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type ErasureResult = {
  erased_at: string;
  subject_email: string;
  user_found: boolean;
  actions: string[];
};

/**
 * Right-to-erasure implementation (GDPR Art. 17 / CCPA).
 * Anonymizes PII in place rather than hard-deleting to preserve referential
 * integrity (issues, audit logs). Auth account is deleted to prevent re-login.
 *
 * Actions taken:
 * - users: name→null, email→anonymized placeholder
 * - issue_comments: body→"[deleted]" for this user
 * - issue_events: user_id nullified (preserves history, removes attribution)
 * - idea_ai_turns: deleted (AI-generated content tied to the user's ideas)
 * - api_keys: revoked
 * - memberships: deleted
 * - notification_prefs: deleted
 * - auth user: deleted via admin API
 */
/**
 * CALLER CONTRACT: this function performs destructive, irreversible operations.
 * Every call site MUST verify super-admin privileges before invoking it.
 * The route at /api/admin/compliance/erase already does this — do not add new
 * callers without an equivalent gate.
 */
export async function eraseSubjectData(email: string): Promise<ErasureResult> {
  const svc = createSupabaseServiceClient();
  const normalised = email.trim().toLowerCase();
  const actions: string[] = [];

  // Resolve user record
  const { data: user } = await svc
    .from("users")
    .select("id, auth_id")
    .eq("email", normalised)
    .maybeSingle();

  if (!user) {
    return { erased_at: new Date().toISOString(), subject_email: normalised, user_found: false, actions: ["No user record found — nothing to erase."] };
  }

  const userId = user.id as string;
  const authId = user.auth_id as string | null;
  const anonymisedEmail = `erased-${userId}@deleted.forge`;

  // 1. Anonymise user profile (keep row for FK integrity)
  await svc.from("users").update({ name: null, email: anonymisedEmail }).eq("id", userId);
  actions.push("Anonymised user profile (name cleared, email replaced with placeholder).");

  // 2. Wipe comment bodies
  const { count: commentCount } = await svc
    .from("issue_comments")
    .update({ body: "[deleted]" })
    .eq("user_id", userId);
  actions.push(`Cleared ${commentCount ?? 0} comment(s) body text.`);

  // 3. Nullify user attribution on issue events (preserves audit history, removes PII)
  await svc.from("issue_events").update({ user_id: null }).eq("user_id", userId);
  actions.push("Removed user attribution from issue events.");

  // 4. Delete AI turn data (explicitly promised in AI policy)
  try {
    await svc.from("idea_ai_turns").delete().eq("user_id", userId);
    actions.push("Deleted AI turn history.");
  } catch {
    // Table may not exist in all environments; non-fatal.
    actions.push("AI turn deletion skipped (table not found).");
  }

  // 5. Revoke API keys
  await svc
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("revoked_at", null);
  actions.push("Revoked all API keys.");

  // 6. Remove memberships
  await svc.from("memberships").delete().eq("user_id", userId);
  actions.push("Removed all workspace memberships.");

  // 7. Remove notification prefs (if table exists — fail open)
  try {
    await svc.from("notification_prefs").delete().eq("user_id", userId);
    actions.push("Removed notification preferences.");
  } catch {
    // table may not exist in all environments
  }

  // 8. Delete auth account (prevents re-login)
  if (authId) {
    try {
      await svc.auth.admin.deleteUser(authId);
      actions.push("Deleted Supabase auth account.");
    } catch (e) {
      actions.push(`Auth deletion failed (may already be gone): ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    erased_at: new Date().toISOString(),
    subject_email: normalised,
    user_found: true,
    actions,
  };
}
