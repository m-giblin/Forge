import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- service-role required: unassigned count bypasses RLS by design; passes through issuesRepo (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { notificationsRepo } from "@/lib/repositories/notifications";
import { issuesRepo } from "@/lib/repositories/issues";
import { loadTenantFlags } from "@/lib/services/featureFlags";
import { getFigmaConfig } from "@/lib/services/figmaIntegration";
import SignOutButton from "@/components/SignOutButton";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import ReportBugButton from "@/components/ReportBugButton";
import NotificationBell from "@/components/NotificationBell";
import CommandPalette from "@/components/CommandPalette";
import SessionTimeoutGuard from "@/components/SessionTimeoutGuard";
import GlobalKeys from "@/components/GlobalKeys";
import AiDisclosureBanner from "@/components/AiDisclosureBanner";
import MobileSidebar from "@/components/MobileSidebar";
import EmberWidget from "@/components/EmberWidget";
import GearMenu from "@/components/GearMenu";
import WorkspaceSidebarNav from "@/components/WorkspaceSidebarNav";
import WorkspaceTopBar from "@/components/WorkspaceTopBar";
import CollapsibleSidebarShell from "@/components/CollapsibleSidebarShell";
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
  const sessionTimeoutMinutes = sessionTimeoutRaw ? parseInt(sessionTimeoutRaw, 10) : 420;

  const [initialNotifications, unreadCount, unassignedCount, flags, userRow, visibleProjects, superAdminRow, planNotifications, figmaConfig] = await Promise.all([
    notificationsRepo(supabase).list(ctx.tenant.id, ctx.appUserId, { limit: 20, includeRead: false }),
    notificationsRepo(supabase).unreadCount(ctx.tenant.id, ctx.appUserId),
    issuesRepo(svc).countUnassigned(ctx.tenant.id),
    loadTenantFlags(ctx.tenant.id),
    (async () => { try { return await supabase.from("users").select("email_digest, ai_disclosure_dismissed_at").eq("id", ctx.appUserId).maybeSingle(); } catch { return { data: null }; } })(),
    (async () => { try { const { data } = await svc.from("projects").select("id", { count: "exact" }).eq("tenant_id", ctx.tenant.id).not("status", "eq", "archived"); return data?.length ?? 0; } catch { return 0; } })(),
    (async () => { try { const { data } = await svc.from("super_admins").select("user_id").eq("user_id", ctx.appUserId).maybeSingle(); return data; } catch { return null; } })(),
    (async () => { try { const { data } = await svc.from("tenant_notifications").select("id, title, feature_key").eq("tenant_id", ctx.tenant.id).is("read_at", null).order("created_at", { ascending: false }).limit(3); return data ?? []; } catch { return []; } })(),
    getFigmaConfig(ctx.tenant.id).catch(() => ({ enabled: false, teamUrl: "" })),
  ]);
  const figmaUrl = figmaConfig.enabled && figmaConfig.teamUrl ? figmaConfig.teamUrl : null;
  const emailDigest = (userRow.data as Record<string, unknown> | null)?.email_digest !== false;
  const aiDisclosureDismissed = !!(userRow.data as Record<string, unknown> | null)?.ai_disclosure_dismissed_at;
  const isAdmin = ctx.role === "owner" || ctx.role === "admin" || ctx.impersonating;
  const isSuperAdmin = !!superAdminRow;

  const initials = (ctx.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#f4f2eb]">
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
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        figmaUrl={figmaUrl}
      />

      {/* ── Desktop Sidebar — hidden on mobile, collapses in Reports ── */}
      <CollapsibleSidebarShell slug={slug}>
      <aside
        className="sticky top-0 flex h-screen w-56 shrink-0 flex-col font-[family-name:var(--font-inter)]"
        style={{
          background: `linear-gradient(165deg, var(--fw-sidebar-1) 0%, var(--fw-sidebar-2) 55%, var(--fw-sidebar-3) 100%)`,
          borderRight: "1px solid var(--fw-sidebar-border)",
        }}
      >
        {/* Forge-Worx wordmark */}
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-[18px] py-4 shrink-0">
          <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md border border-[#3a3c33] bg-[var(--fw-sidebar-3)]">
            <svg width="20" height="12.5" viewBox="0 0 64 40" aria-hidden="true">
              <path d="M3,19 L17,11 L17,8 L50,8 L50,15 L41,15 L37,22 L46,22 L48,32 L35,32 Q31,27 27,32 L13,32 L15,22 L24,22 L20,15 L20,11 Z" fill="var(--fw-rust)" />
            </svg>
          </div>
          <p className="font-[family-name:var(--font-manrope)] text-[15.5px] font-extrabold uppercase tracking-[0.03em] text-[var(--fw-text-bright)]">
            Forge<span className="text-[var(--fw-rust)]">-Worx</span>
          </p>
        </div>

        {/* Workspace switcher */}
        <div className="mx-3.5 my-3.5 flex shrink-0 items-center gap-2.5 rounded-[5px] border border-[#34362c] bg-[var(--fw-sidebar-2)] px-2.5 py-[9px]">
          <div
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded border border-[#3a1e15] text-[11px] font-extrabold text-[#efe6d0]"
            style={{ background: "linear-gradient(135deg,var(--fw-rust-dark),var(--fw-rust-border))" }}
          >
            {(ctx.tenant.name || "?").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-bold text-[var(--fw-text-bright)]">{ctx.tenant.name}</p>
            <p className="truncate text-[10.5px] text-[var(--fw-text-dimmer)] capitalize">{ctx.role}</p>
          </div>
        </div>

        <WorkspaceSidebarNav
          slug={slug}
          unreadCount={unreadCount}
          visibleProjects={visibleProjects as number}
          opsLayer={!!flags.ops_layer}
        />

        {/* User footer */}
        <div className="shrink-0 border-t border-[var(--fw-sidebar-border)] px-3 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--fw-rust)]/20 text-xs font-bold text-[var(--fw-text-bright)]">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[var(--fw-text-bright)]">{ctx.email}</p>
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
            <GearMenu slug={slug} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} rbacEnabled={!!flags.rbac} figmaUrl={figmaUrl} />
          </div>
          <SignOutButton className="mt-2 w-full rounded-lg px-3 py-1.5 text-left text-xs text-[var(--fw-text-dimmer)] hover:bg-[var(--fw-sidebar-2)] hover:text-[var(--fw-text-bright)] transition" />
        </div>
      </aside>
      </CollapsibleSidebarShell>

      {/* ── Main content ── */}
      <div className="flex min-w-0 flex-1 flex-col pt-14 md:pt-0">
        <WorkspaceTopBar slug={slug} />
        {/* Plan feature notification banners */}
        {(planNotifications as { id: string; title: string; feature_key: string | null }[]).length > 0 && (
          <div className="flex flex-col gap-0 shrink-0">
            {(planNotifications as { id: string; title: string; feature_key: string | null }[]).map((n) => (
              <div key={n.id} className="flex items-center gap-3 px-4 py-2 bg-[#8c4632] text-white text-xs font-medium">
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
              ? "bg-[#c0392b] text-white"
              : trialDaysLeft <= 3
              ? "bg-[#c9791d] text-white"
              : "bg-[#8c4632] text-white"
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
      <AiDisclosureBanner slug={slug} initiallyDismissed={aiDisclosureDismissed} />
      <SessionTimeoutGuard timeoutMinutes={isNaN(sessionTimeoutMinutes) ? 420 : sessionTimeoutMinutes} />
      <Suspense fallback={null}>
        <EmberWidget slug={slug} />
      </Suspense>
    </div>
  );
}
