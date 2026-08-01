import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";

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
    <div className="flex min-h-full flex-1 flex-col">
      {!isAdmin && ctx.impersonating && (
        <div className="bg-[#fdf1de] px-5 py-2 text-sm text-[#8a5a12] border-b border-[#f3ddb4]">
          Support view — read-only. Changes are disabled.
        </div>
      )}

      {/* Admin nav now lives in the main workspace sidebar (see /[tenant]/layout.tsx) — this just hosts the page content. */}
      <div className="flex-1 overflow-y-auto p-8 bg-neutral-50 min-w-0">
        {children}
      </div>
    </div>
  );
}
