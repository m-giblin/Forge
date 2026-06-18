import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { loadTenantFlags } from "@/lib/services/featureFlags";

// Gate the entire Think Tank area behind the think_tank flag. Off → coming-soon.
export default async function ThinkTankLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const flags = await loadTenantFlags(ctx.tenant.id);
  if (!flags.think_tank) redirect(`/${slug}/coming-soon?f=think_tank`);
  return <>{children}</>;
}
