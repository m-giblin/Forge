import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import AdminSidebar from "@/components/AdminSidebar";

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
    <div className="flex min-h-full flex-1">
      {!isAdmin && ctx.impersonating && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-amber-50 px-5 py-2 text-sm text-amber-800 border-b border-amber-200">
          Support view — read-only. Changes are disabled.
        </div>
      )}

      {/* Grouped settings sidebar */}
      <AdminSidebar slug={slug} />

      {/* Page content */}
      <div className="flex-1 overflow-y-auto p-8 bg-neutral-50 min-w-0">
        {children}
      </div>
    </div>
  );
}
