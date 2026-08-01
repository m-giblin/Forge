"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SidebarNavItem from "./SidebarNavItem";
import GearMenu from "./GearMenu";

type TenantFlags = Record<string, boolean>;

interface Props {
  slug: string;
  tenantName: string;
  role: string;
  flags: TenantFlags;
  unreadCount: number;
  visibleProjects: number;
  initials: string;
  email: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  figmaUrl?: string | null;
}

export default function MobileSidebar({
  slug,
  tenantName,
  role,
  flags,
  unreadCount,
  visibleProjects,
  initials,
  email,
  isAdmin = false,
  isSuperAdmin = false,
  figmaUrl = null,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const close = () => setIsOpen(false);

  return (
    <>
      {/* ── Mobile Top Bar ── */}
      <header
        className="fixed top-0 left-0 right-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--fw-sidebar-border)] px-4 md:hidden font-[family-name:var(--font-inter)]"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          height: "calc(3.5rem + env(safe-area-inset-top))",
          background: `linear-gradient(170deg, var(--fw-sidebar-1) 0%, var(--fw-sidebar-2) 100%)`,
        }}
      >
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open navigation"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--fw-text-dim)] hover:bg-[var(--fw-sidebar-2)] transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
          </svg>
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#3a3c33] bg-[var(--fw-sidebar-3)]">
            <svg width="15" height="9.4" viewBox="0 0 64 40" aria-hidden="true">
              <path d="M3,19 L17,11 L17,8 L50,8 L50,15 L41,15 L37,22 L46,22 L48,32 L35,32 Q31,27 27,32 L13,32 L15,22 L24,22 L20,15 L20,11 Z" fill="var(--fw-rust)" />
            </svg>
          </div>
          <p className="truncate font-[family-name:var(--font-manrope)] text-[13px] font-extrabold uppercase tracking-[0.02em] text-[var(--fw-text-bright)]">
            Forge<span className="text-[var(--fw-rust)]">-Worx</span>
          </p>
        </div>

        {unreadCount > 0 && (
          <Link
            href={`/${slug}/inbox`}
            className="ml-auto flex h-7 min-w-7 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </Link>
        )}
        {unreadCount === 0 && (
          <Link
            href={`/${slug}/inbox`}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fw-text-dim)] hover:bg-[var(--fw-sidebar-2)] transition-colors"
            aria-label="Inbox"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 5l7 5 7-5M2 5v9a1 1 0 001 1h12a1 1 0 001-1V5M2 5a1 1 0 011-1h12a1 1 0 011 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        )}
      </header>

      {/* Mobile spacer so content isn't hidden behind the fixed header */}
      <div className="h-14 md:hidden" />

      {/* ── Backdrop ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* ── Slide-in Drawer ── */}
      <div
        className={`fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-[var(--fw-sidebar-border)] transition-transform duration-250 ease-out md:hidden font-[family-name:var(--font-inter)] ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: `linear-gradient(165deg, var(--fw-sidebar-1) 0%, var(--fw-sidebar-2) 55%, var(--fw-sidebar-3) 100%)`,
        }}
        aria-label="Navigation drawer"
      >
        {/* Drawer header — wordmark */}
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-[18px] py-4 shrink-0">
          <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md border border-[#3a3c33] bg-[var(--fw-sidebar-3)]">
            <svg width="20" height="12.5" viewBox="0 0 64 40" aria-hidden="true">
              <path d="M3,19 L17,11 L17,8 L50,8 L50,15 L41,15 L37,22 L46,22 L48,32 L35,32 Q31,27 27,32 L13,32 L15,22 L24,22 L20,15 L20,11 Z" fill="var(--fw-rust)" />
            </svg>
          </div>
          <p className="flex-1 font-[family-name:var(--font-manrope)] text-[15.5px] font-extrabold uppercase tracking-[0.03em] text-[var(--fw-text-bright)]">
            Forge<span className="text-[var(--fw-rust)]">-Worx</span>
          </p>
          <button
            onClick={close}
            aria-label="Close navigation"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--fw-text-dimmer)] hover:bg-[var(--fw-sidebar-2)] hover:text-[var(--fw-text-bright)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Workspace switcher */}
        <div className="mx-3.5 my-3.5 flex shrink-0 items-center gap-2.5 rounded-[5px] border border-[#34362c] bg-[var(--fw-sidebar-2)] px-2.5 py-[9px]">
          <div
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded border border-[#3a1e15] text-[11px] font-extrabold text-[#efe6d0]"
            style={{ background: "linear-gradient(135deg,var(--fw-rust-dark),var(--fw-rust-border))" }}
          >
            {(tenantName || "?").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-bold text-[var(--fw-text-bright)]">{tenantName}</p>
            <p className="truncate text-[10.5px] text-[var(--fw-text-dimmer)] capitalize">{role}</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          <div>
            <div className="space-y-0.5">
              <SidebarNavItem href={`/${slug}`} icon="🏠" label="Home" onClick={close} />
            </div>
          </div>

          <div>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--fw-text-dimmer)]">Execution</p>
            <div className="space-y-0.5">
              <SidebarNavItem href={`/${slug}/assigned`} icon="📌" label="My Work" onClick={close} />
              <SidebarNavItem href={`/${slug}/inbox`} icon="📥" label="Inbox" badge={unreadCount > 0 ? unreadCount : undefined} onClick={close} />
              <SidebarNavItem href={`/${slug}/me/today`} icon="🎯" label="My Day" onClick={close} />
              <SidebarNavItem href={`/${slug}/board`} icon="🏃" label="Sprint board" badge={visibleProjects > 1 ? visibleProjects : undefined} badgeColor="rust" onClick={close} />
              <SidebarNavItem href={`/${slug}/calendar`} icon="🗓️" label="Calendar" onClick={close} />
              <SidebarNavItem href={`/${slug}/timeline`} icon="📅" label="Timeline" onClick={close} />
              {flags.ops_layer && <SidebarNavItem href={`/${slug}/time`} icon="⏱️" label="My Time" onClick={close} />}
              <SidebarNavItem href={`/${slug}/backlog`} icon="🧹" label="Backlog" onClick={close} />
              <SidebarNavItem href={`/${slug}/issues`} icon="🐛" label="Table" onClick={close} />
            </div>
          </div>

          <div>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--fw-text-dimmer)]">Planning</p>
            <div className="space-y-0.5">
              <SidebarNavItem href={`/${slug}/projects`} icon="📋" label="Projects" onClick={close} />
              <SidebarNavItem href={`/${slug}/roadmap`} icon="🗺️" label="Roadmap" onClick={close} />
              <SidebarNavItem href={`/${slug}/portfolio`} icon="📦" label="Portfolio" onClick={close} />
              <SidebarNavItem href={`/${slug}/mindmap`} icon="🧠" label="Mind Map" onClick={close} />
            </div>
          </div>

          <div>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--fw-text-dimmer)]">Insights</p>
            <div className="space-y-0.5">
              <SidebarNavItem href={`/${slug}/reports`} icon="📊" label="Reports" onClick={close} />
              <SidebarNavItem href={`/${slug}/dashboards`} icon="🧩" label="Dashboards" onClick={close} />
            </div>
          </div>

          <div>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--fw-text-dimmer)]">Collaboration</p>
            <div className="space-y-0.5">
              <SidebarNavItem href={`/${slug}/workload`} icon="👥" label="Team" onClick={close} />
              <SidebarNavItem href={`/${slug}/think-tank`} icon="💡" label="Think Tank" onClick={close} />
              <SidebarNavItem href={`/${slug}/whiteboards`} icon="🖊️" label="Whiteboards" onClick={close} />
            </div>
          </div>

          <div>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--fw-text-dimmer)]">Relationships</p>
            <div className="space-y-0.5">
              <SidebarNavItem href={`/${slug}/customers`} icon="🏢" label="Customers" onClick={close} />
              <SidebarNavItem href={`/${slug}/stakeholder`} icon="📈" label="Stakeholder" onClick={close} />
              <SidebarNavItem href={`/${slug}/changelog`} icon="📋" label="Changelog" onClick={close} />
            </div>
          </div>

          <div>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--fw-text-dimmer)]">Review</p>
            <div className="space-y-0.5">
              <SidebarNavItem href={`/${slug}/code-review`} icon="🔀" label="Code Review" onClick={close} />
              <SidebarNavItem href={`/${slug}/watching`} icon="👁" label="Watching" onClick={close} />
            </div>
          </div>

          {/* Admin/Super Admin routes still require a desktop viewport to use,
              but the gear menu itself (Preferences/Spaces/Docs/Support + the
              admin entries when applicable) is reachable from the footer below. */}
        </nav>

        {/* User footer */}
        <div className="shrink-0 border-t border-[var(--fw-sidebar-border)] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--fw-rust)]/20 text-xs font-bold text-[var(--fw-text-bright)]">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[var(--fw-text-bright)]">{email}</p>
              <p className="text-[11px] text-[var(--fw-text-dimmer)] capitalize">{role}</p>
            </div>
            <GearMenu slug={slug} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} rbacEnabled={!!flags.rbac} figmaUrl={figmaUrl} />
          </div>
          <form action="/api/auth/signout" method="POST" className="mt-2">
            <button type="submit" className="w-full rounded-lg px-3 py-1.5 text-left text-xs text-[var(--fw-text-dimmer)] hover:bg-[var(--fw-sidebar-2)] hover:text-[var(--fw-text-bright)] transition">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
