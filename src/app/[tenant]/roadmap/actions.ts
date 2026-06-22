"use server";

import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ctxCanDo } from "@/lib/rbac";

export async function saveRoadmapPositionAction(
  slug: string,
  projectId: string,
  positionPct: number,
  widthPct: number,
) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (!ctxCanDo(ctx, "manage_roadmap")) return;

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
