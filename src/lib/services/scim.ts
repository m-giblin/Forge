import "server-only";
import { randomBytes } from "node:crypto";
import { hashKey, parseBearer } from "@/lib/api/keys";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { membersRepo } from "@/lib/repositories/members";

// SCIM 2.0 (RFC 7643 / 7644) — minimal but real: enough for Okta, Azure AD,
// and OneLogin's standard SCIM push-provisioning connectors to create,
// update, deactivate, and delete users automatically. Groups are out of
// scope for v1 — role/permission mapping via SCIM groups is a real feature,
// just a separately-scoped one from "close the deprovisioning gap."

export type ScimAuthResult = { ok: true; tenantId: string } | { ok: false; status: number; detail: string };

/** Verifies the bearer token on an inbound SCIM request and resolves it to a tenant. */
export async function authenticateScim(req: Request): Promise<ScimAuthResult> {
  const token = parseBearer(req.headers.get("authorization"));
  if (!token) return { ok: false, status: 401, detail: "Missing bearer token." };

  const svc = createSupabaseServiceClient();
  const tokenHash = hashKey(token);
  const { data } = await svc
    .from("tenant_scim_tokens")
    .select("tenant_id, enabled, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!data || !data.enabled || data.revoked_at) {
    return { ok: false, status: 401, detail: "Invalid or revoked SCIM token." };
  }

  void svc.from("tenant_scim_tokens").update({ last_used_at: new Date().toISOString() }).eq("tenant_id", data.tenant_id as string);
  return { ok: true, tenantId: data.tenant_id as string };
}

/** Generates a new SCIM token for a tenant, replacing any existing one (one active token per tenant). */
export async function issueScimToken(tenantId: string): Promise<string> {
  const raw = `scim_${randomBytes(24).toString("hex")}`;
  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("tenant_scim_tokens")
    .upsert(
      { tenant_id: tenantId, token_hash: hashKey(raw), enabled: true, revoked_at: null, created_at: new Date().toISOString() },
      { onConflict: "tenant_id" }
    );
  if (error) throw error;
  return raw;
}

export async function revokeScimToken(tenantId: string): Promise<void> {
  const svc = createSupabaseServiceClient();
  await svc.from("tenant_scim_tokens").update({ revoked_at: new Date().toISOString(), enabled: false }).eq("tenant_id", tenantId);
}

export async function getScimTokenStatus(tenantId: string): Promise<{ configured: boolean; lastUsedAt: string | null }> {
  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("tenant_scim_tokens")
    .select("enabled, revoked_at, last_used_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return { configured: !!data && data.enabled && !data.revoked_at, lastUsedAt: (data?.last_used_at as string | null) ?? null };
}

// ---------------------------------------------------------------------------
// SCIM User resource mapping (Forge users + memberships <-> SCIM User schema)
// ---------------------------------------------------------------------------

export type ScimUser = {
  schemas: string[];
  id: string;
  userName: string;
  name?: { givenName?: string; familyName?: string };
  displayName?: string;
  emails?: { value: string; primary: boolean }[];
  active: boolean;
  meta: { resourceType: "User"; created?: string; lastModified?: string; location?: string };
};

const USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";

function toScimUser(row: { id: string; email: string; name: string | null; created_at?: string }, active: boolean): ScimUser {
  return {
    schemas: [USER_SCHEMA],
    id: row.id,
    userName: row.email,
    displayName: row.name ?? undefined,
    emails: [{ value: row.email, primary: true }],
    active,
    meta: { resourceType: "User", created: row.created_at, location: `/api/scim/v2/Users/${row.id}` },
  };
}

/** GET /Users — list, with optional userName filter (the standard pre-create existence check IdPs run) and pagination. */
export async function listScimUsers(tenantId: string, opts: { filterEmail?: string; startIndex: number; count: number }) {
  const svc = createSupabaseServiceClient();
  let query = svc
    .from("memberships")
    .select("user_id, users!inner(id, email, name, created_at)", { count: "exact" })
    .eq("tenant_id", tenantId);

  if (opts.filterEmail) query = query.eq("users.email", opts.filterEmail);

  const from = Math.max(0, opts.startIndex - 1);
  const to = from + opts.count - 1;
  const { data, count } = await query.range(from, to);

  const resources = (data ?? []).map((m) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    return toScimUser(u as { id: string; email: string; name: string | null; created_at: string }, true);
  });

  return { resources, totalResults: count ?? resources.length };
}

/** POST /Users — provision. Find-or-create the user row, then add (or reactivate) the membership. */
export async function createScimUser(tenantId: string, input: { userName: string; displayName?: string; active?: boolean }) {
  const email = input.userName.trim().toLowerCase();
  const svc = createSupabaseServiceClient();

  const { data: existingMembership } = await svc
    .from("memberships")
    .select("user_id, users!inner(email)")
    .eq("tenant_id", tenantId)
    .eq("users.email", email)
    .maybeSingle();
  if (existingMembership) return { conflict: true as const };

  let { data: user } = await svc.from("users").select("id, email, name, created_at").eq("email", email).maybeSingle();
  if (!user) {
    const { data: created, error } = await svc
      .from("users")
      .insert({ email, name: input.displayName ?? null })
      .select("id, email, name, created_at")
      .single();
    if (error) throw error;
    user = created;
  }

  await membersRepo(svc).add(tenantId, user.id as string, "member");
  return { conflict: false as const, user: toScimUser(user as { id: string; email: string; name: string | null; created_at: string }, true) };
}

/** GET /Users/{id} */
export async function getScimUser(tenantId: string, userId: string): Promise<ScimUser | null> {
  const svc = createSupabaseServiceClient();
  const { data: membership } = await svc.from("memberships").select("user_id").eq("tenant_id", tenantId).eq("user_id", userId).maybeSingle();
  if (!membership) return null;
  const { data: user } = await svc.from("users").select("id, email, name, created_at").eq("id", userId).maybeSingle();
  if (!user) return null;
  return toScimUser(user, true);
}

/**
 * PATCH/PUT /Users/{id} — update attributes, and handle the `active` toggle,
 * which is how Okta/Azure AD actually signal deprovisioning (they PATCH
 * active=false rather than DELETE in most default connector configs).
 */
export async function updateScimUser(
  tenantId: string,
  userId: string,
  patch: { displayName?: string; active?: boolean }
): Promise<ScimUser | null> {
  const svc = createSupabaseServiceClient();
  const { data: membership } = await svc.from("memberships").select("user_id").eq("tenant_id", tenantId).eq("user_id", userId).maybeSingle();
  if (!membership) return null;

  if (patch.displayName !== undefined) {
    await svc.from("users").update({ name: patch.displayName }).eq("id", userId);
  }
  if (patch.active === false) {
    await svc.from("memberships").delete().eq("tenant_id", tenantId).eq("user_id", userId);
    const { data: user } = await svc.from("users").select("id, email, name, created_at").eq("id", userId).maybeSingle();
    return user ? toScimUser(user, false) : null;
  }

  const { data: user } = await svc.from("users").select("id, email, name, created_at").eq("id", userId).maybeSingle();
  return user ? toScimUser(user, true) : null;
}

/** DELETE /Users/{id} — some IdPs deprovision via hard delete instead of PATCH active=false. Same effect: remove the membership. */
export async function deleteScimUser(tenantId: string, userId: string): Promise<boolean> {
  const svc = createSupabaseServiceClient();
  const { data: membership } = await svc.from("memberships").select("user_id").eq("tenant_id", tenantId).eq("user_id", userId).maybeSingle();
  if (!membership) return false;
  await svc.from("memberships").delete().eq("tenant_id", tenantId).eq("user_id", userId);
  return true;
}
