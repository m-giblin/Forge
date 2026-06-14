import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import AdminSidebar from "@/components/AdminSidebar";

/**
 * Tenant admin portal. Gated once here:
 *  - owner/admin → full access
 *  - super admin impersonating ("view portal") → allowed, read-only
 *  - anyone else → bounced to the board
 * Pages still pass a `readOnly` flag to their managers (controls disabled) and
 * the underlying actions re-check admin role server-side.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  if (!isAdmin && !ctx.impersonating) redirect(`/${slug}/board`);

  return (
    <main className="mx-auto max-w-5xl px-6 py-6">
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Workspace admin</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Manage members, fields, API keys, and review activity for {ctx.tenant.name}.
      </p>
      {!isAdmin && ctx.impersonating && (
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Support view — read-only. Changes are disabled.
        </div>
      )}
      <div className="flex gap-6">
        <AdminSidebar slug={slug} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main>
  );
}
