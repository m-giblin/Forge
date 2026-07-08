import "server-only";
import { randomBytes } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { hashKey } from "@/lib/api/keys";
import { membersRepo, type MemberRow, type MembershipRole } from "@/lib/repositories/members";
import { invitesRepo, type InviteRow } from "@/lib/repositories/invites";

export const ASSIGNABLE_ROLES: MembershipRole[] = ["admin", "member", "viewer"];

// ---- Members (admin UI, human path: RLS enforces owner/admin) ----

// Read helpers accept `impersonating`: a super admin in support view isn't a
// member, so RLS would hide everything — use the service-role client then
// (queries stay tenant-scoped). Writes never run in that mode (role = viewer).
async function readClient(impersonating: boolean) {
  return impersonating ? createSupabaseServiceClient() : await createSupabaseServerClient();
}

export async function listMembers(tenantId: string, impersonating = false): Promise<MemberRow[]> {
  return membersRepo(await readClient(impersonating)).list(tenantId);
}

export async function changeMemberRole(tenantId: string, membershipId: string, role: MembershipRole): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const repo = membersRepo(supabase);
  const target = await repo.getById(tenantId, membershipId);
  if (!target) throw new Error("Member not found.");
  if (target.role === "owner" && role !== "owner" && (await repo.countOwners(tenantId)) <= 1) {
    throw new Error("Can't demote the last owner — promote someone else first.");
  }
  await repo.updateRole(tenantId, membershipId, role);
}

export async function removeMember(tenantId: string, membershipId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const repo = membersRepo(supabase);
  const target = await repo.getById(tenantId, membershipId);
  if (!target) return;
  if (target.role === "owner" && (await repo.countOwners(tenantId)) <= 1) {
    throw new Error("Can't remove the last owner.");
  }
  await repo.remove(tenantId, membershipId);
}

// ---- Invites ----

export async function listPendingInvites(tenantId: string, impersonating = false): Promise<InviteRow[]> {
  return invitesRepo(await readClient(impersonating)).listPending(tenantId);
}

/** Create an invite; returns the raw single-use token (shown once). */
export async function createInvite(input: {
  tenantId: string;
  role: MembershipRole;
  email: string | null;
  createdBy: string | null;
  displayName?: string | null;
  jobTitles?: string[];
}): Promise<{ token: string }> {
  if (!ASSIGNABLE_ROLES.includes(input.role)) throw new Error("Invalid role.");
  const token = randomBytes(24).toString("hex");
  const supabase = await createSupabaseServerClient();
  await invitesRepo(supabase).create({
    tenant_id: input.tenantId,
    email: input.email,
    role: input.role,
    token_hash: hashKey(token),
    created_by: input.createdBy,
    display_name: input.displayName ?? null,
    job_titles: input.jobTitles ?? [],
  });
  return { token };
}

export async function revokeInvite(tenantId: string, id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await invitesRepo(supabase).revoke(tenantId, id);
}

// ---- Accept flow (service-role: joiner isn't a member yet; token authorizes) ----

export type InviteDescription =
  | { valid: false; reason: string }
  | { valid: true; tenantName: string; tenantSlug: string; role: MembershipRole; email: string | null };

export async function describeInvite(token: string): Promise<InviteDescription> {
  const supabase = createSupabaseServiceClient();
  const inv = await invitesRepo(supabase).findUsableByHash(hashKey(token));
  if (!inv) return { valid: false, reason: "This invite link is invalid." };
  if (inv.accepted_at) return { valid: false, reason: "This invite has already been used." };
  if (new Date(inv.expires_at) < new Date()) return { valid: false, reason: "This invite has expired." };
  // Accepted exception: tenant name+slug lookup needed to build the preview UI. No
  // dedicated repo method warranted for a single caller in this invite-validation path.
  const { data: tenant } = await supabase.from("tenants").select("name, slug").eq("id", inv.tenant_id).maybeSingle();
  if (!tenant) return { valid: false, reason: "Workspace no longer exists." };
  return { valid: true, tenantName: tenant.name, tenantSlug: tenant.slug, role: inv.role, email: inv.email };
}

/**
 * Provision an account for someone holding a valid invite. The single-use
 * invite token vouches for them, so we auto-confirm the email (avoids globally
 * disabling email confirmation, which we want ON for everyone else). Does NOT
 * create the membership — the client then signs in and calls acceptInvite.
 */
export async function provisionInvitedAccount(token: string, email: string, password: string): Promise<void> {
  const svc = createSupabaseServiceClient();
  const inv = await invitesRepo(svc).findUsableByHash(hashKey(token));
  if (!inv) throw new Error("This invite link is invalid.");
  if (inv.accepted_at) throw new Error("This invite has already been used.");
  if (new Date(inv.expires_at) < new Date()) throw new Error("This invite has expired.");
  if (inv.email && inv.email.toLowerCase() !== email.toLowerCase()) {
    throw new Error("This invite is for a different email address.");
  }
  const { error } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    if (/already.*regist|already.*exist/i.test(error.message)) {
      throw new Error("An account with this email already exists — switch to Sign in.");
    }
    throw error;
  }
}

/** Accept an invite for the currently-authenticated user. Returns tenant slug. */
export async function acceptInvite(token: string): Promise<string> {
  const userClient = await createSupabaseServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) throw new Error("You must be signed in to accept an invite.");

  const svc = createSupabaseServiceClient();
  const invites = invitesRepo(svc);
  const inv = await invites.findUsableByHash(hashKey(token));
  if (!inv) throw new Error("This invite link is invalid.");
  if (inv.accepted_at) throw new Error("This invite has already been used.");
  if (new Date(inv.expires_at) < new Date()) throw new Error("This invite has expired.");
  if (inv.email && inv.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    throw new Error("This invite is for a different email address.");
  }

  // Seat quota — the actual moment a seat gets consumed is when a membership
  // row is created, not when the invite is sent, so this is the real gate.
  const { data: seatTenant } = await svc.from("tenants").select("subscription_seats").eq("id", inv.tenant_id).maybeSingle();
  const seatLimit = (seatTenant?.subscription_seats as number | null) ?? 1;
  const { count: activeMembers } = await svc
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", inv.tenant_id);
  if ((activeMembers ?? 0) >= seatLimit) {
    throw new Error(`This workspace is at its seat limit (${seatLimit}). Ask an owner to add seats in Billing before accepting.`);
  }

  // Accepted exception: user upsert on invite claim is a one-off provisioning step
  // (find-or-create the app user row for the Supabase auth identity). No repo method
  // warranted — this is the only place that ever bootstraps a user this way.
  let appUserId: string;
  const { data: existing } = await svc.from("users").select("id").eq("auth_id", user.id).maybeSingle();
  if (existing) {
    appUserId = existing.id;
  } else {
    const { data: created, error } = await svc
      .from("users")
      .insert({ auth_id: user.id, email: user.email, name: user.user_metadata?.name ?? null })
      .select("id")
      .single();
    if (error) throw error;
    appUserId = created.id;
  }

  // Single-use claim, then add the membership.
  const claimed = await invites.claim(inv.id, appUserId);
  if (!claimed) throw new Error("This invite has already been used.");
  await membersRepo(svc).add(claimed.tenant_id, appUserId, claimed.role);

  // Apply job titles set by the admin during invite, if any.
  if (inv.job_titles?.length) {
    await svc.from("memberships")
      .update({ job_titles: inv.job_titles })
      .eq("tenant_id", claimed.tenant_id)
      .eq("user_id", appUserId);
  }

  // Apply display name hint if the user didn't already have a row (brand new signup).
  if (inv.display_name && !existing) {
    await svc.from("users").update({ name: inv.display_name }).eq("id", appUserId);
  }

  // Accepted exception: slug lookup to build the redirect URL after claim. Single caller.
  const { data: tenant } = await svc.from("tenants").select("slug").eq("id", claimed.tenant_id).single();
  if (!tenant) throw new Error("Workspace not found.");
  return tenant.slug as string;
}
