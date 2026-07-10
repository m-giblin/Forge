import { redirect, notFound } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role read: mind map spans idea/project/epic/sprint/issue tables via one tree-builder (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { buildProjectMindMapTree } from "@/lib/services/mindMap";
import { projectsRepo } from "@/lib/repositories/projects";
import MindMapCanvas from "./MindMapCanvas";

export default async function MindMapPage({
  params,
}: {
  params: Promise<{ tenant: string; key: string }>;
}) {
  const { tenant: slug, key } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const svc = createSupabaseServiceClient();
  const project = await projectsRepo(svc).getByKey(ctx.tenant.id, key);
  if (!project) notFound();

  const tree = await buildProjectMindMapTree(svc, ctx.tenant.id, key, slug);
  if (!tree) notFound();

  return (
    <div className="px-6 py-4">
      <MindMapCanvas slug={slug} projectKey={key} projectId={project.id} initialTree={tree} />
    </div>
  );
}
