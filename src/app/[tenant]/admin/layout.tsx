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
    <div className="flex min-h-full flex-col">
      {/* Admin header bar */}
      <div className="flex items-center gap-3 border-b border-neutral-200 bg-neutral-900 px-6 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-sm font-bold text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{ctx.email}</p>
          <p className="text-[11px] text-indigo-300">{roleLabel}</p>
        </div>
        <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white">
          Admin
        </span>
      </div>

      {!isAdmin && ctx.impersonating && (
        <div className="bg-amber-50 px-6 py-2 text-sm text-amber-800">
          Support view — read-only. Changes are disabled.
        </div>
      )}

      <div className="flex flex-1 gap-0 px-6 py-6">
        <AdminSidebar slug={slug} />
        <div className="min-w-0 flex-1 pl-6">{children}</div>
      </div>
    </div>
  );
}
