"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/super-admin";
import { saveStripeConfig } from "@/lib/services/stripeConfig";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function saveStripeConfigAction(input: {
  secretKey?: string;
  publishableKey?: string;
  webhookSecret?: string;
}) {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  await saveStripeConfig({
    secretKey: input.secretKey?.trim() || null,
    publishableKey: input.publishableKey?.trim() || null,
    webhookSecret: input.webhookSecret?.trim() || null,
  });
  revalidatePath("/admin/billing");
}

export async function setPlanPriceIdAction(planKey: string, stripePriceId: string) {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("plan_tiers")
    .update({ stripe_price_id: stripePriceId.trim() || null })
    .eq("key", planKey);
  if (error) throw error;
  revalidatePath("/admin/billing");
}
