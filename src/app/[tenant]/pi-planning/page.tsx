import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { listPiCycles } from "@/lib/services/piPlanning";
import PiPlanningLanding from "./PiPlanningLanding";

export default async function PiPlanningPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (ctx.role === "viewer") redirect(`/${slug}/board`);

  const cycles = await listPiCycles(ctx.tenant.id);

  return (
    <main className="w-full">
      <PiPlanningLanding
        slug={slug}
        cycles={cycles.map((c) => ({ id: c.id, name: c.name, startDate: c.startDate, endDate: c.endDate, status: c.status }))}
      />
    </main>
  );
}
