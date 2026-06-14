import { redirect } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { notificationsRepo } from "@/lib/repositories/notifications";
import SignOutButton from "@/components/SignOutButton";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import ReportBugButton from "@/components/ReportBugButton";
import NotificationBell from "@/components/NotificationBell";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  // Load initial notification state server-side (no waterfall — parallel).
  const [supabase, svc] = await Promise.all([
    ctx.impersonating ? Promise.resolve(createSupabaseServiceClient()) : createSupabaseServerClient(),
    Promise.resolve(createSupabaseServiceClient()),
  ]);

  const [initialNotifications, unreadCount, unassignedResult] = await Promise.all([
    notificationsRepo(supabase).list(ctx.appUserId, { limit: 20, includeRead: false }),
    notificationsRepo(supabase).unreadCount(ctx.appUserId),
    svc
      .from("issues")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenant.id)
      .is("assignee_id", null)
      .neq("status", "done"),
  ]);

  return (
    <div className="min-h-screen bg-neutral-50">
      {ctx.impersonating && <ImpersonationBanner tenantName={ctx.tenant.name} />}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-bold tracking-tight text-neutral-900">
              Forge
            </Link>
            <span className="text-sm text-neutral-400">/</span>
            <Link href={`/${slug}`} className="text-sm font-medium text-neutral-700 hover:text-neutral-900">
              {ctx.tenant.name}
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href={`/${slug}`}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
              >
                Projects
              </Link>
              <Link
                href={`/${slug}/issues`}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
              >
                Issues
              </Link>
              <Link
                href={`/${slug}/board`}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
              >
                Board
              </Link>
              {(ctx.role === "owner" || ctx.role === "admin" || ctx.impersonating) && (
                <Link
                  href={`/${slug}/admin`}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
                >
                  Admin
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell
              slug={slug}
              userId={ctx.appUserId}
              tenantId={ctx.tenant.id}
              initialCount={unreadCount}
              initialNotifications={initialNotifications}
              unassignedCount={unassignedResult.count ?? 0}
            />
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
              {ctx.role}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      {children}
      {process.env.FORGE_SELF_API_KEY && <ReportBugButton />}
    </div>
  );
}
