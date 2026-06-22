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

  const initials = (ctx.email ?? "?").slice(0, 2).toUpperCase();
  const roleLabel = ctx.impersonating ? "Support View" : ctx.role === "owner" ? "Owner · Super Admin" : "Admin";

  return (
    <div className="flex min-h-screen bg-neutral-50">
      {/* Grouped sidebar */}
      <AdminSidebar slug={slug} />

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header bar */}
        <div className="flex items-center gap-3 border-b border-neutral-200 bg-white px-6 py-3 shrink-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900">{ctx.email}</p>
            <p className="text-[11px] text-neutral-500">{roleLabel}</p>
          </div>
          {!isAdmin && ctx.impersonating && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
              Support View
            </span>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}
