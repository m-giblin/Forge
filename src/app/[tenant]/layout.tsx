import { redirect } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- service-role required: unassigned count bypasses RLS by design; passes through issuesRepo (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { notificationsRepo } from "@/lib/repositories/notifications";
import { issuesRepo } from "@/lib/repositories/issues";
import { loadTenantFlags } from "@/lib/services/featureFlags";
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

  // MFA enforcement gate — runs before rendering any workspace page.
  // Impersonation sessions are exempt (super-admin support path).
  if (!ctx.impersonating) {
    const supabaseForMfa = await createSupabaseServerClient();
    const [tenantRes, aalRes] = await Promise.all([
      supabaseForMfa.from("tenants").select("require_mfa").eq("id", ctx.tenant.id).single(),
      supabaseForMfa.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    const requireMfa = tenantRes.data?.require_mfa ?? false;
    const currentLevel = aalRes.data?.currentLevel ?? "aal1";
    if (requireMfa && currentLevel !== "aal2") {
      const next = encodeURIComponent(`/${slug}/board`);
      redirect(`/mfa-required?next=${next}`);
    }
  }

  // Load initial notification state server-side (no waterfall — parallel).
  const [supabase, svc] = await Promise.all([
    ctx.impersonating ? Promise.resolve(createSupabaseServiceClient()) : createSupabaseServerClient(),
    Promise.resolve(createSupabaseServiceClient()),
  ]);

  const [initialNotifications, unreadCount, unassignedCount, flags] = await Promise.all([
    notificationsRepo(supabase).list(ctx.appUserId, { limit: 20, includeRead: false }),
    notificationsRepo(supabase).unreadCount(ctx.appUserId),
    issuesRepo(svc).countUnassigned(ctx.tenant.id),
    loadTenantFlags(ctx.tenant.id),
  ]);

  // Board-first nav. The bug tracker (Board + Issues) always shows; the
  // project-management items appear with a "Soon" badge until released.
  const navItems: { label: string; href: string; enabled: boolean; key?: string }[] = [
    { label: "Board", href: `/${slug}/board`, enabled: true },
    { label: "Issues", href: `/${slug}/issues`, enabled: true },
    { label: "Home", href: `/${slug}`, enabled: flags.dashboards, key: "dashboards" },
    { label: "Projects", href: `/${slug}/projects`, enabled: flags.project_portal, key: "project_portal" },
    { label: "Think Tank", href: `/${slug}/think-tank`, enabled: flags.think_tank, key: "think_tank" },
  ];

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
              {navItems.map((item) =>
                item.enabled ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <Link
                    key={item.label}
                    href={`/${slug}/coming-soon?f=${item.key}`}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-400 hover:bg-neutral-100"
                    title="Coming soon"
                  >
                    {item.label}
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Soon</span>
                  </Link>
                )
              )}
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
              unassignedCount={unassignedCount}
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
