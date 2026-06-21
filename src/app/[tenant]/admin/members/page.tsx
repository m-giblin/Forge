import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { listMembers, listPendingInvites } from "@/lib/services/members";
import { loadTenantFlags } from "@/lib/services/featureFlags";
import MembersManager from "./MembersManager";

export default async function MembersPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const readOnly = !(ctx.role === "owner" || ctx.role === "admin");
  const flags = await loadTenantFlags(ctx.tenant.id);

  return (
    <section>
      <h2 className="text-base font-semibold text-neutral-900">Members</h2>
      <p className="mt-1 text-sm text-neutral-500">People in this workspace and their roles. Invite teammates with a single-use link.</p>
      <MembersManager
        slug={slug}
        currentUserId={ctx.appUserId}
        members={await listMembers(ctx.tenant.id, ctx.impersonating)}
        invites={await listPendingInvites(ctx.tenant.id, ctx.impersonating)}
        readOnly={readOnly}
        showJobTitles={flags.job_titles ?? false}
      />
    </section>
  );
}
