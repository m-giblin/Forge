import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import AdminTopNav from "@/components/AdminTopNav";

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
      <div className="flex items-center gap-3 border-b border-neutral-800 bg-neutral-900 px-5 py-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">
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
        <div className="bg-amber-50 px-5 py-2 text-sm text-amber-800">
          Support view — read-only. Changes are disabled.
        </div>
      )}

      {/* Horizontal tab nav — replaces the old sidebar */}
      <AdminTopNav slug={slug} />

      {/* Content */}
      <div className="flex-1 px-6 py-6">
        {children}
      </div>
    </div>
  );
}
