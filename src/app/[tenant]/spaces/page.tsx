import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import SpacesHubClient from "./SpacesHubClient";

export default async function SpacesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);

  const svc = createSupabaseServiceClient();

  const { data: spaces } = await svc
    .from("spaces")
    .select("id, type, project_id, owner_id, name, icon, description, archived_at, updated_at, projects(key, name)")
    .eq("tenant_id", ctx.tenant.id)
    .is("archived_at", null)
    .order("type")
    .order("name");

  // Filter personal spaces to owner only
  const visible = (spaces ?? []).filter((s) => {
    if (s.type === "personal") return s.owner_id === ctx.appUserId;
    return true;
  });

  // Recent pages across all visible spaces
  const spaceIds = visible.map((s) => s.id);
  const { data: recentPages } = spaceIds.length
    ? await svc
        .from("pages")
        .select("id, space_id, title, icon, updated_at, updated_by")
        .in("space_id", spaceIds)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(8)
    : { data: [] };

  return (
    <SpacesHubClient
      slug={slug}
      userId={ctx.appUserId}
      role={ctx.role}
      spaces={visible as unknown as SpaceRow[]}
      recentPages={recentPages ?? []}
    />
  );
}

export type SpaceRow = {
  id: string;
  type: "project" | "team" | "personal";
  project_id: string | null;
  owner_id: string | null;
  name: string;
  icon: string;
  description: string | null;
  archived_at: string | null;
  updated_at: string;
  projects?: { key: string; name: string } | null;
};
