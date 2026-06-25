import "server-only";
import { randomBytes } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { requireSuperAdmin } from "@/lib/super-admin";
import { hashKey } from "@/lib/api/keys";
import { platformRepo, type TenantStat } from "@/lib/repositories/platform";
import { projectsRepo } from "@/lib/repositories/projects";
import { invitesRepo } from "@/lib/repositories/invites";
import { slaPoliciesRepo } from "@/lib/repositories/slaPolicies";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export async function listTenants(): Promise<TenantStat[]> {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  return platformRepo(createSupabaseServiceClient()).listTenants();
}

/**
 * Provision a tenant and mint an owner invite link (reuses the invite system).
 * Returns the join token — the super admin sends the link to the new owner,
 * who signs up and becomes owner. Returns null token if email omitted.
 */
export async function provisionTenant(input: {
  name: string;
  slug: string;
  ownerEmail: string;
}): Promise<{ slug: string; ownerInviteToken: string }> {
  const sa = await requireSuperAdmin();
  if (!sa) throw new Error("Forbidden");

  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  if (!name) throw new Error("Workspace name is required.");
  if (!SLUG_RE.test(slug)) throw new Error("Slug must be lowercase letters, numbers, and hyphens.");
  if (!ownerEmail) throw new Error("Owner email is required.");

  const svc = createSupabaseServiceClient();
  const repo = platformRepo(svc);

  const tenant = await repo.insertTenant(name, slug);

  // Seed example SLA policies (disabled) so new tenants can see what's possible
  // and enable/tweak without starting from a blank form.
  const slaRepo = slaPoliciesRepo(svc);
  await slaRepo.create(tenant.id, {
    name: "High priority response SLA",
    conditions: { priority: ["high"] },
    tiers: [
      { type: "response", hours: 4, action: "notify" },
      { type: "resolution", hours: 24, action: "notify" },
    ],
    enabled: false,
  });
  await slaRepo.create(tenant.id, {
    name: "Medium priority response SLA",
    conditions: { priority: ["medium"] },
    tiers: [
      { type: "response", hours: 8, action: "notify" },
      { type: "resolution", hours: 72, action: "notify" },
    ],
    enabled: false,
  });

  const token = randomBytes(24).toString("hex");
  await invitesRepo(svc).create({
    tenant_id: tenant.id,
    email: ownerEmail,
    role: "owner",
    token_hash: hashKey(token),
    created_by: sa.appUserId,
  });

  await repo.writeAudit({
    tenant_id: tenant.id,
    actor_user_id: sa.appUserId,
    actor_label: sa.email,
    action: "tenant.provision",
    target: slug,
    metadata: { ownerEmail },
  });

  return { slug: tenant.slug, ownerInviteToken: token };
}

export async function setTenantSuspended(id: string, suspended: boolean): Promise<void> {
  const sa = await requireSuperAdmin();
  if (!sa) throw new Error("Forbidden");
  const svc = createSupabaseServiceClient();
  const repo = platformRepo(svc);
  const slug = await repo.getSlug(id);
  await repo.setStatus(id, suspended ? "suspended" : "active");
  await repo.writeAudit({
    tenant_id: id,
    actor_user_id: sa.appUserId,
    actor_label: sa.email,
    action: suspended ? "tenant.suspend" : "tenant.unsuspend",
    target: slug ?? id,
  });
}

export async function deleteTenant(id: string): Promise<void> {
  const sa = await requireSuperAdmin();
  if (!sa) throw new Error("Forbidden");
  const svc = createSupabaseServiceClient();
  const repo = platformRepo(svc);

  const slug = await repo.getSlug(id);
  await repo.deleteTenant(id);
  await repo.writeAudit({
    tenant_id: null, // tenant is gone; record as a platform event
    actor_user_id: sa.appUserId,
    actor_label: sa.email,
    action: "tenant.delete",
    target: slug ?? id,
  });
}
