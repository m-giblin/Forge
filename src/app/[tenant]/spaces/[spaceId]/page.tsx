import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import SpaceViewClient from "./SpaceViewClient";

export default async function SpacePage({
  params,
}: {
  params: Promise<{ tenant: string; spaceId: string }>;
}) {
  const { tenant: slug, spaceId } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);

  const svc = createSupabaseServiceClient();

  const { data: space } = await svc
    .from("spaces")
    .select("id, type, project_id, owner_id, name, icon, description, archived_at, projects(key, name)")
    .eq("id", spaceId)
    .eq("tenant_id", ctx.tenant.id)
    .single();

  if (!space) redirect(`/${slug}/spaces`);
  if (space.type === "personal" && space.owner_id !== ctx.appUserId) redirect(`/${slug}/spaces`);

  const { data: pages } = await svc
    .from("pages")
    .select("id, parent_id, title, icon, position, status, updated_at")
    .eq("space_id", spaceId)
    .eq("tenant_id", ctx.tenant.id)
    .eq("status", "active")
    .order("position")
    .order("created_at");

  const canEdit = ctx.role === "owner" || ctx.role === "admin" || ctx.role === "member";

  return (
    <SpaceViewClient
      slug={slug}
      userId={ctx.appUserId}
      role={ctx.role}
      canEdit={canEdit}
      space={space as unknown as SpaceData}
      initialPages={pages ?? []}
    />
  );
}

export type SpaceData = {
  id: string;
  type: "project" | "team" | "personal";
  project_id: string | null;
  owner_id: string | null;
  name: string;
  icon: string;
  description: string | null;
  archived_at: string | null;
  projects?: { key: string; name: string } | null;
};

export type PageMeta = {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  position: number;
  status: string;
  updated_at: string;
};
