import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
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
import MobileSidebar from "@/components/MobileSidebar";
import { getTenantSetting } from "@/lib/tenantSettings";

function trialDaysRemaining(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  return Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

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

  // ── Trial expiry gate ────────────────────────────────────────────────────
  // Check subscription status and redirect expired trials to billing page.
  // We read x-pathname (injected by proxy.ts) to avoid redirecting from /billing itself.
  const svc0 = createSupabaseServiceClient();
  const { data: billingData } = await svc0
    .from("tenants")
    .select("subscription_status, subscription_tier, trial_ends_at")
    .eq("id", ctx.tenant.id)
    .single();

  const headersList = await headers();
  const currentPath = headersList.get("x-pathname") ?? "";
  const isOnBillingPage = currentPath.includes("/billing");

  if (billingData?.subscription_status === "expired" && !isOnBillingPage) {
    redirect(`/${slug}/billing`);
  }

  // Compute trial banner data (shown when trialing)
  const isTrialing = billingData?.subscription_status === "trialing";
  const trialDaysLeft = trialDaysRemaining(billingData?.trial_ends_at ?? null);

  const [supabase, svc] = await Promise.all([
    ctx.impersonating ? Promise.resolve(createSupabaseServiceClient()) : createSupabaseServerClient(),
    Promise.resolve(createSupabaseServiceClient()),
  ]);

  const sessionTimeoutRaw = await getTenantSetting(ctx.tenant.id, "session_timeout_minutes");
  const sessionTimeoutMinutes = sessionTimeoutRaw ? parseInt(sessionTimeoutRaw, 10) : 30;

  const [initialNotifications, unreadCount, unassignedCount, flags, userRow, visibleProjects, superAdminRow, planNotifications] = await Promise.all([
    notificationsRepo(supabase).list(ctx.tenant.id, ctx.appUserId, { limit: 20, includeRead: false }),
    notificationsRepo(supabase).unreadCount(ctx.tenant.id, ctx.appUserId),
    issuesRepo(svc).countUnassigned(ctx.tenant.id),
    loadTenantFlags(ctx.tenant.id),
    (async () => { try { return await supabase.from("users").select("email_digest").eq("id", ctx.appUserId).maybeSingle(); } catch { return { data: null }; } })(),
    (async () => { try { const { data } = await svc.from("projects").select("id", { count: "exact" }).eq("tenant_id", ctx.tenant.id).not("status", "eq", "archived"); return data?.length ?? 0; } catch { return 0; } })(),
    (async () => { try { const { data } = await svc.from("super_admins").select("user_id").eq("user_id", ctx.appUserId).maybeSingle(); return data; } catch { return null; } })(),
    (async () => { try { const { data } = await svc.from("tenant_notifications").select("id, title, feature_key").eq("tenant_id", ctx.tenant.id).is("read_at", null).order("created_at", { ascending: false }).limit(3); return data ?? []; } catch { return []; } })(),
  ]);
  const emailDigest = (userRow.data as Record<string, unknown> | null)?.email_digest !== false;
  const isAdmin = ctx.role === "owner" || ctx.role === "admin" || ctx.impersonating;
  const isSuperAdmin = !!superAdminRow;

  const initials = (ctx.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-neutral-50">
      {ctx.impersonating && <ImpersonationBanner tenantName={ctx.tenant.name} />}

      {/* ── Mobile nav (hamburger + drawer) — hidden on md+ ── */}
      <MobileSidebar
        slug={slug}
        tenantName={ctx.tenant.name}
        role={ctx.role}
        flags={flags}
        unreadCount={unreadCount}
        visibleProjects={visibleProjects as number}
        initials={initials}
        email={ctx.email ?? ""}
      />

      {/* ── Desktop Sidebar — hidden on mobile ── */}
      <aside className="sticky top-0 hidden md:flex h-screen w-56 shrink-0 flex-col border-r border-neutral-200 bg-white overflow-hidden">
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
              <SideLink href={`/${slug}/me/today`} icon="🎯" label="My Day" />
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
      <div className="flex min-w-0 flex-1 flex-col pt-14 md:pt-0">
        {/* Plan feature notification banners */}
        {(planNotifications as { id: string; title: string; feature_key: string | null }[]).length > 0 && (
          <div className="flex flex-col gap-0 shrink-0">
            {(planNotifications as { id: string; title: string; feature_key: string | null }[]).map((n) => (
              <div key={n.id} className="flex items-center gap-3 px-4 py-2 bg-indigo-600 text-white text-xs font-medium">
                <span>✦</span>
                <span className="flex-1">{n.title}</span>
                <Link href={`/${slug}/admin/features`} className="shrink-0 underline font-semibold">View features →</Link>
              </div>
            ))}
          </div>
        )}

        {/* Trial countdown banner — shown to all workspace members during trial */}
        {isTrialing && trialDaysLeft !== null && !isOnBillingPage && (
          <div className={`flex items-center justify-between gap-3 px-4 py-2 text-xs font-semibold shrink-0 ${
            trialDaysLeft <= 1
              ? "bg-red-600 text-white"
              : trialDaysLeft <= 3
              ? "bg-orange-500 text-white"
              : "bg-indigo-600 text-white"
          }`}>
            <span>
              {trialDaysLeft <= 0
                ? "⚠️ Your Premium trial has ended."
                : trialDaysLeft === 1
                ? "⚠️ Your Premium trial ends today."
                : `⏰ ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left on your Premium trial.`}
              {" "}Full Premium access until then.
            </span>
            <Link
              href={`/${slug}/billing`}
              className="shrink-0 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-[11px] font-bold hover:bg-white/30 transition"
            >
              Upgrade now →
            </Link>
          </div>
        )}
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
