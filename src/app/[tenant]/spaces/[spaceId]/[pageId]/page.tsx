import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import SpaceViewClient from "../SpaceViewClient";
import type { SpaceData, PageMeta } from "../page";

// Deep-link directly to a specific page within a space
export default async function PageRoute({
  params,
}: {
  params: Promise<{ tenant: string; spaceId: string; pageId: string }>;
}) {
  const { tenant: slug, spaceId, pageId } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);

  const svc = createSupabaseServiceClient();

  const [{ data: space }, { data: pages }] = await Promise.all([
    svc
      .from("spaces")
      .select("id, type, project_id, owner_id, name, icon, description, archived_at, projects(key, name)")
      .eq("id", spaceId)
      .eq("tenant_id", ctx.tenant.id)
      .single(),
    svc
      .from("pages")
      .select("id, parent_id, title, icon, position, status, updated_at")
      .eq("space_id", spaceId)
      .eq("tenant_id", ctx.tenant.id)
      .eq("status", "active")
      .order("position")
      .order("created_at"),
  ]);

  if (!space) redirect(`/${slug}/spaces`);
  if (space.type === "personal" && space.owner_id !== ctx.appUserId) redirect(`/${slug}/spaces`);

  const canEdit = ctx.role === "owner" || ctx.role === "admin" || ctx.role === "member";

  return (
    <SpaceViewClient
      slug={slug}
      userId={ctx.appUserId}
      role={ctx.role}
      canEdit={canEdit}
      space={space as unknown as SpaceData}
      initialPages={pages ?? []}
      initialPageId={pageId}
    />
  );
}
