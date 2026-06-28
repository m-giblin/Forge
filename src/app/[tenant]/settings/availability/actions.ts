"use server";

import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: availability upsert bypasses user-JWT RLS (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { memberAvailabilityRepo } from "@/lib/repositories/memberAvailability";
import { revalidatePath } from "next/cache";

const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];
const DEFAULT_HOURS = 40;

export async function getMyAvailabilityAction(slug: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized");
  const supabase = createSupabaseServiceClient();
  const repo = memberAvailabilityRepo(supabase);
  const row = await repo.getForUser(ctx.tenant.id, ctx.appUserId);
  return row ?? { hours_per_week: DEFAULT_HOURS, work_days: DEFAULT_WORK_DAYS };
}

export async function saveMyAvailabilityAction(
  slug: string,
  hoursPerWeek: number,
  workDays: number[],
) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized");
  const supabase = createSupabaseServiceClient();
  const repo = memberAvailabilityRepo(supabase);
  await repo.upsert(ctx.tenant.id, ctx.appUserId, hoursPerWeek, workDays);
  revalidatePath(`/${slug}/settings/availability`);
}
