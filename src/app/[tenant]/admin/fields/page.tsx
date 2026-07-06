import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { getTenantSchema } from "@/lib/services/fieldConfig";
// eslint-disable-next-line no-restricted-imports -- admin page needs project list (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { projectsRepo } from "@/lib/repositories/projects";
import FieldsManager from "./FieldsManager";
import CategoryImporter from "./CategoryImporter";

export default async function FieldsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const readOnly = !(ctx.role === "owner" || ctx.role === "admin");

  const svc = createSupabaseServiceClient();
  const projects = await projectsRepo(svc).listByTenant(ctx.tenant.id);

  return (
    <section>
      <h2 className="text-base font-semibold text-neutral-900">Fields & categories</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Customize the statuses, priorities, types, and categories used by issues in this workspace.
      </p>
      <FieldsManager slug={slug} schema={await getTenantSchema(ctx.tenant.id, ctx.impersonating)} readOnly={readOnly} />
      {!readOnly && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-neutral-800 mb-1">Bulk import categories</h3>
          <p className="text-xs text-neutral-500 mb-3">Upload a CSV to populate categories for a specific project. Select the project, upload your file, preview the tree, then confirm.</p>
          <CategoryImporter
            slug={slug}
            projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name }))}
          />
        </div>
      )}
    </section>
  );
}
