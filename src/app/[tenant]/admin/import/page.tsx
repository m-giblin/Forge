import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { getTenantSchema } from "@/lib/services/fieldConfig";
import { listVisibleProjects } from "@/lib/services/projects";
import ImportWizard from "./ImportWizard";

export default async function ImportPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  const readOnly = !isAdmin || ctx.impersonating;

  const [schema, projects] = await Promise.all([
    getTenantSchema(ctx.tenant.id, ctx.impersonating),
    listVisibleProjects(ctx.tenant.id, ctx.appUserId, ctx.role, ctx.impersonating),
  ]);

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold text-neutral-900">Import issues</h2>
      <p className="mb-5 text-sm text-neutral-500">
        Upload a CSV to bulk-create issues. Only <code className="rounded bg-neutral-100 px-1 font-mono text-xs">title</code> is required.
        Values for status, priority, and type may be the option key or label.
      </p>
      {readOnly ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Import is disabled in read-only / support-view mode.
        </p>
      ) : (
        <ImportWizard
          slug={slug}
          projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name }))}
          statuses={schema.statuses}
          priorities={schema.priorities}
          types={schema.types}
          categories={schema.categories}
          customFields={schema.customFields}
        />
      )}
    </div>
  );
}
