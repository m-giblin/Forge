"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { saveFigmaConfig, type FigmaConfig } from "@/lib/services/figmaIntegration";

export async function saveFigmaConfigAction(slug: string, config: FigmaConfig): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (!["owner", "admin"].includes(ctx.role)) throw new Error("Admins only");
  if (config.teamUrl && !config.teamUrl.startsWith("https://www.figma.com/")) {
    throw new Error("Team URL must be a real Figma team/workspace link (https://www.figma.com/...).");
  }
  await saveFigmaConfig(ctx.tenant.id, { enabled: config.enabled, teamUrl: config.teamUrl.trim() });
  revalidatePath(`/${slug}/admin/settings/figma`);
}
