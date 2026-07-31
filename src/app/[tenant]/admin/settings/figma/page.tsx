import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { getFigmaConfig } from "@/lib/services/figmaIntegration";
import FigmaSettingsClient from "./FigmaSettingsClient";

export default async function FigmaSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (!["owner", "admin"].includes(ctx.role)) redirect(`/${slug}/board`);

  const config = await getFigmaConfig(ctx.tenant.id);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <FigmaSettingsClient slug={slug} config={config} />
    </div>
  );
}
