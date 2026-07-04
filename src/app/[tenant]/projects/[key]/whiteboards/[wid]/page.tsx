import { redirect, notFound } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: always scoped by tenantId (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { projectsRepo } from "@/lib/repositories/projects";
import WhiteboardEditor from "./WhiteboardEditor";

interface Props {
  params: Promise<{ tenant: string; key: string; wid: string }>;
}

export default async function WhiteboardPage({ params }: Props) {
  const { tenant: slug, key, wid } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const svc = createSupabaseServiceClient();
  const project = await projectsRepo(svc).getByKey(ctx.tenant.id, key);
  if (!project) notFound();

  const { data: whiteboard, error } = await svc
    .from("project_whiteboards")
    .select("id, name, state")
    .eq("tenant_id", ctx.tenant.id)
    .eq("project_id", project.id)
    .eq("id", wid)
    .single();

  if (error || !whiteboard) notFound();

  return (
    <WhiteboardEditor
      slug={slug}
      projectId={project.id}
      projectKey={key}
      whiteboard={{ id: whiteboard.id, name: whiteboard.name as string, state: whiteboard.state as Record<string, unknown> | null }}
      canEdit={ctx.role !== "viewer" && !ctx.impersonating}
    />
  );
}
