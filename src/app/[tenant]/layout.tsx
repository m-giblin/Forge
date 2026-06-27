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
import CommandPalette from "@/components/CommandPalette";
import SidebarSearchButton from "@/components/SidebarSearchButton";
import SessionTimeoutGuard from "@/components/SessionTimeoutGuard";
import GlobalKeys from "@/components/GlobalKeys";
import AiDisclosureBanner from "@/components/AiDisclosureBanner";
import { getTenantSetting } from "@/lib/tenantSettings";

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

  const [supabase, svc] = await Promise.all([
    ctx.impersonating ? Promise.resolve(createSupabaseServiceClient()) : createSupabaseServerClient(),
    Promise.resolve(createSupabaseServiceClient()),
  ]);

  const sessionTimeoutRaw = await getTenantSetting(ctx.tenant.id, "session_timeout_minutes");
  const sessionTimeoutMinutes = sessionTimeoutRaw ? parseInt(sessionTimeoutRaw, 10) : 30;

  const [initialNotifications, unreadCount, unassignedCount, flags, userRow, visibleProjects, superAdminRow] = await Promise.all([
    notificationsRepo(supabase).list(ctx.tenant.id, ctx.appUserId, { limit: 20, includeRead: false }),
    notificationsRepo(supabase).unreadCount(ctx.tenant.id, ctx.appUserId),
    issuesRepo(svc).countUnassigned(ctx.tenant.id),
    loadTenantFlags(ctx.tenant.id),
    (async () => { try { return await supabase.from("users").select("email_digest").eq("id", ctx.appUserId).maybeSingle(); } catch { return { data: null }; } })(),
    (async () => { try { const { data } = await svc.from("projects").select("id", { count: "exact" }).eq("tenant_id", ctx.tenant.id).not("status", "eq", "archived"); return data?.length ?? 0; } catch { return 0; } })(),
    (async () => { try { const { data } = await svc.from("super_admins").select("user_id").eq("user_id", ctx.appUserId).maybeSingle(); return data; } catch { return null; } })(),
  ]);
  const emailDigest = (userRow.data as Record<string, unknown> | null)?.email_digest !== false;
  const isAdmin = ctx.role === "owner" || ctx.role === "admin" || ctx.impersonating;
  const isSuperAdmin = !!superAdminRow;

  const initials = (ctx.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-neutral-50">
      {ctx.impersonating && <ImpersonationBanner tenantName={ctx.tenant.name} />}

      {/* ── Sidebar ── */}
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-neutral-200 bg-white overflow-hidden">
        {/* Logo + workspace */}
        <div className="flex items-center gap-2.5 border-b border-neutral-100 px-4 py-4 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 overflow-hidden">
            <img src="/logo-28.png" alt="Forge" className="h-7 w-7 object-cover" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-900">{ctx.tenant.name}</p>
            <p className="text-[11px] text-neutral-400 capitalize">{ctx.role}</p>
          </div>
        </div>

        {/* Search button */}
        <div className="shrink-0 px-2 py-2 border-b border-neutral-100">
          <SidebarSearchButton />
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5 min-w-0">

          {/* My Work */}
          <div>
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">My Work</p>
            <div className="space-y-0.5">
              <SideLink href={`/${slug}`} icon="🏠" label="Home" />
              <SideLink href={`/${slug}/assigned`} icon="📌" label="Assigned to Me" />
              <SideLink href={`/${slug}/watching`} icon="👁" label="Watching" />
              <SideLink href={`/${slug}/inbox`} icon="📥" label="Inbox" badge={unreadCount > 0 ? unreadCount : undefined} />
            </div>
          </div>

          {/* Workspace */}
          <div>
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Workspace</p>
            <div className="space-y-0.5">
              <SideLink href={`/${slug}/board`} icon="🏃" label="Board" badge={visibleProjects > 1 ? visibleProjects : undefined} badgeColor="indigo" />
              <SideLink href={`/${slug}/issues`} icon="🐛" label="Issues" />
              <SideLink href={`/${slug}/projects`} icon="📋" label="Projects" />
              <SideLink href={`/${slug}/roadmap`} icon="🗺️" label="Roadmap" />
              <SideLink href={`/${slug}/timeline`} icon="📅" label="Timeline" />
              <SideLink href={`/${slug}/calendar`} icon="🗓️" label="Calendar" />
              <SideLink href={`/${slug}/workload`} icon="👥" label="Workload" />
              {flags.ops_layer && <SideLink href={`/${slug}/time`} icon="⏱️" label="My Time" />}
            </div>
          </div>

          {/* Intelligence */}
          <div>
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Intelligence</p>
            <div className="space-y-0.5">
              <SideLink href={`/${slug}/reports`} icon="📊" label="Reports" />
              <SideLink href={`/${slug}/think-tank`} icon="💡" label="Think Tank" />
              <SideLink href={`/${slug}/customers`} icon="🏢" label="Customers" />
              <SideLink href={`/${slug}/stakeholder`} icon="📈" label="Stakeholder" />
              <SideLink href={`/${slug}/changelog`} icon="📋" label="Changelog" />
            </div>
          </div>

          {/* User */}
          <div>
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">You</p>
            <div className="space-y-0.5">
              <SideLink href={`/${slug}/settings`} icon="🔔" label="Preferences" />
              <SideLink href={`/${slug}/spaces`} icon="📚" label="Spaces" />
              <SideLink href={`/${slug}/docs`} icon="📖" label="Help Docs" />
              <SideLink href={`/${slug}/support`} icon="🎫" label="Get Support" />
            </div>
          </div>

          {/* Admin */}
          {isAdmin && (
            <div>
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Admin</p>
              <div className="space-y-0.5">
                <SideLink href={`/${slug}/admin`} icon="⚙️" label="Settings" />
                {flags.rbac && <SideLink href={`/${slug}/admin/roles`} icon="🔐" label="Roles" />}
              </div>
            </div>
          )}
        </nav>

        {/* Platform Admin escape hatch — super admins only */}
        {isSuperAdmin && (
          <div className="shrink-0 border-t border-neutral-100 px-2 py-2">
            <Link
              href="/admin"
              className="flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-700 transition-colors"
            >
              <span className="text-sm">⚡</span>
              <span className="flex-1">Platform Admin</span>
              <span className="text-[10px] text-neutral-400">↗</span>
            </Link>
          </div>
        )}

        {/* User footer */}
        <div className="shrink-0 border-t border-neutral-100 px-3 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-neutral-800">{ctx.email}</p>
            </div>
            <NotificationBell
              slug={slug}
              userId={ctx.appUserId}
              tenantId={ctx.tenant.id}
              initialCount={unreadCount}
              initialNotifications={initialNotifications}
              unassignedCount={unassignedCount}
              emailDigest={emailDigest}
            />
          </div>
          <SignOutButton className="mt-2 w-full rounded-lg px-3 py-1.5 text-left text-xs text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800 transition" />
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {children}
      </div>

      {process.env.FORGE_SELF_API_KEY && <ReportBugButton />}
      <CommandPalette slug={slug} />
      <GlobalKeys slug={slug} />
      <AiDisclosureBanner />
      <SessionTimeoutGuard timeoutMinutes={isNaN(sessionTimeoutMinutes) ? 30 : sessionTimeoutMinutes} />
    </div>
  );
}

function SideLink({
  href,
  icon,
  label,
  badge,
  badgeColor = "red",
}: {
  href: string;
  icon: string;
  label: string;
  badge?: number;
  badgeColor?: "red" | "indigo";
}) {
  const badgeCls = badgeColor === "indigo"
    ? "bg-indigo-600"
    : "bg-red-500";
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge != null && (
        <span className={`flex h-4 min-w-4 items-center justify-center rounded-full ${badgeCls} px-1 text-[10px] font-bold text-white`}>
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}
