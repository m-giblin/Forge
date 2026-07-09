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
 * - issues: reporter_id/assignee_id nullified where they reference this user
 * - issue_attachments: uploaded_by nullified (file itself is not removed —
 *   see the scope note below)
 * - support_tickets: submitted_by nullified, title/body redacted, and
 *   actor_label overwritten — this field is an email snapshot explicitly
 *   designed to survive the user row being deleted, so it must be handled
 *   here or erasure is incomplete by construction
 * - idea_ai_turns: deleted (AI-generated content tied to the user's ideas)
 * - api_keys: revoked
 * - memberships: deleted
 * - notification_prefs: deleted
 * - auth user: deleted via admin API
 *
 * SCOPE NOTE — deliberately NOT touched, disclosed rather than silently
 * gapped:
 * - Issue titles/descriptions the subject authored are left as-is. These are
 *   shared team business records (other people's work references them), and
 *   safely distinguishing "this text is about the subject" from "this text
 *   happens to have been typed by the subject" is not reliably automatable
 *   without either destroying institutional record or false-positiving on
 *   unrelated content.
 * - customer_accounts / customer_issue_links (Customer Voice / CRM-lite) have
 *   no foreign key to `users` at all — there is nothing structurally
 *   erasable there. A user's name could theoretically appear in a free-text
 *   `notes` field written by someone else; that is a manual-review case, not
 *   an automatable one.
 * - Attachment files in storage are not deleted, only their uploader
 *   attribution in the DB — a follow-up if file-content erasure is required.
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
    .update({ body: "[deleted]" }, { count: "exact" })
    .eq("user_id", userId);
  actions.push(`Cleared ${commentCount ?? 0} comment(s) body text.`);

  // 3. Nullify user attribution on issue events (preserves audit history, removes PII)
  await svc.from("issue_events").update({ user_id: null }).eq("user_id", userId);
  actions.push("Removed user attribution from issue events.");

  // 3a. Nullify reporter/assignee attribution on issues themselves.
  const { count: reporterCount } = await svc.from("issues").update({ reporter_id: null }, { count: "exact" }).eq("reporter_id", userId);
  const { count: assigneeCount } = await svc.from("issues").update({ assignee_id: null }, { count: "exact" }).eq("assignee_id", userId);
  actions.push(`Removed reporter attribution from ${reporterCount ?? 0} issue(s) and assignee attribution from ${assigneeCount ?? 0} issue(s).`);

  // 3b. Nullify attachment uploader attribution (file itself is not deleted — see scope note above).
  try {
    const { count: attachmentCount } = await svc.from("issue_attachments").update({ uploaded_by: null }, { count: "exact" }).eq("uploaded_by", userId);
    actions.push(`Removed uploader attribution from ${attachmentCount ?? 0} attachment(s).`);
  } catch {
    actions.push("Attachment attribution removal skipped (table not found).");
  }

  // 3c. Support tickets: redact free text + the durable email snapshot, not just the FK.
  // actor_label exists specifically to survive user deletion, so it must be
  // overwritten explicitly or this erasure would be incomplete by design.
  try {
    const { count: ticketCount } = await svc
      .from("support_tickets")
      .update({ submitted_by: null, actor_label: null, title: "[deleted]", body: "[deleted]" }, { count: "exact" })
      .eq("submitted_by", userId);
    actions.push(`Redacted ${ticketCount ?? 0} support ticket(s).`);
  } catch {
    actions.push("Support ticket redaction skipped (table not found).");
  }

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
