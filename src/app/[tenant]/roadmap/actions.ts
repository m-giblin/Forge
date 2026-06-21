"use server";

import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function saveRoadmapPositionAction(
  slug: string,
  projectId: string,
  positionPct: number,
  widthPct: number,
) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  // Only owners/admins may reorder the roadmap
  if (ctx.role !== "owner" && ctx.role !== "admin") return;

  const supabase = await createSupabaseServerClient();
  // roadmap_position/width are stored as 0-100 in our UI but the column is numeric(4,3) (0.000–1.000).
  // Divide by 100 to store as fraction; multiply by 100 on read.
  await supabase
    .from("projects")
    .update({
      roadmap_position: Math.round(positionPct) / 100,
      roadmap_width: Math.round(widthPct) / 100,
    })
    .eq("id", projectId)
    .eq("tenant_id", ctx.tenant.id);
}
