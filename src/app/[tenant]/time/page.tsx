import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { loadTenantFlags } from "@/lib/services/featureFlags";
import { getActiveTimerAction, getWeeklyTimesheetAction } from "./actions";
import TimesheetClient from "./TimesheetClient";

export default async function TimePage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const flags = await loadTenantFlags(ctx.tenant.id);
  if (!flags.ops_layer) redirect(`/${slug}/board`);

  // Get current Monday
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const weekStart = monday.toISOString().split("T")[0];

  const [activeTimer, weekData] = await Promise.all([
    getActiveTimerAction(slug),
    getWeeklyTimesheetAction(slug, weekStart),
  ]);

  return (
    <TimesheetClient
      slug={slug}
      weekStart={weekStart}
      initialWeekData={weekData}
      activeTimer={activeTimer}
      isPremium={flags.ops_layer_premium}
    />
  );
}
