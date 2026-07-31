import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { projectsRepo } from "@/lib/repositories/projects";
import { listGuestLinks } from "@/lib/services/guestLinks";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- impersonation client-select: ctx.impersonating chooses service vs user JWT, all DB calls go through repos (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import GuestAccessManager from "./GuestAccessManager";

export default async function GuestAccessPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const readOnly = !(ctx.role === "owner" || ctx.role === "admin");

  const client = ctx.impersonating ? createSupabaseServiceClient() : await createSupabaseServerClient();
  const [projects, links] = await Promise.all([
    projectsRepo(client).listByTenant(ctx.tenant.id),
    listGuestLinks(ctx.tenant.id),
  ]);

  const linkMap = Object.fromEntries(links.map((l) => [l.project_id, { isActive: l.is_active }]));

  return (
    <section>
      <h2 className="text-base font-semibold text-neutral-900">Guest &amp; client access</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Generate a view-only link to a project&apos;s Board and Roadmap — no login required. Anyone with the link can view; revoke it any time.
      </p>
      <GuestAccessManager
        slug={slug}
        readOnly={readOnly}
        projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name }))}
        linkMap={linkMap}
      />
    </section>
  );
}
