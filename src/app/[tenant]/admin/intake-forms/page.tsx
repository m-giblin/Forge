import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { listIntakeForms } from "@/lib/services/intakeForms";
// eslint-disable-next-line no-restricted-imports -- admin page needs project list (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { projectsRepo } from "@/lib/repositories/projects";
import IntakeFormsManager from "./IntakeFormsManager";

export default async function IntakeFormsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const readOnly = !(ctx.role === "owner" || ctx.role === "admin");

  const svc = createSupabaseServiceClient();
  const [forms, projects] = await Promise.all([
    listIntakeForms(ctx.tenant.id),
    projectsRepo(svc).listByTenant(ctx.tenant.id),
  ]);

  return (
    <section>
      <h2 className="text-base font-semibold text-neutral-900">Intake forms</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Public forms external people can submit without an account — each submission lands in a review list here; convert the ones you want into real issues.
      </p>
      <IntakeFormsManager
        slug={slug}
        readOnly={readOnly}
        forms={forms.map((f) => ({ id: f.id, name: f.name, description: f.description, projectId: f.project_id, isActive: f.is_active }))}
        projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name }))}
      />
    </section>
  );
}
