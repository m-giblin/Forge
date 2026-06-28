"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
}

function NavLink({
  href,
  icon,
  label,
  badge,
  badgeColor = "red",
  onClick,
}: {
  href: string;
  icon: string;
  label: string;
  badge?: number;
  badgeColor?: "red" | "indigo";
  onClick: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== `/${href.split("/")[1]}` && pathname.startsWith(href));
  const badgeCls = badgeColor === "indigo" ? "bg-indigo-600" : "bg-red-500";
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
        isActive
          ? "bg-indigo-50 font-medium text-indigo-700"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
      }`}
    >
      <span className="text-base leading-none w-5 text-center">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge != null && (
        <span className={`flex h-4 min-w-4 items-center justify-center rounded-full ${badgeCls} px-1 text-[10px] font-bold text-white`}>
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
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
      <header className="fixed top-0 left-0 right-0 z-30 flex h-14 items-center gap-3 border-b border-neutral-200 bg-white px-4 md:hidden">
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open navigation"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
          </svg>
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="h-6 w-6 rounded-md bg-neutral-900 overflow-hidden flex-shrink-0">
            <img src="/logo-28.png" alt="Forge" className="h-6 w-6 object-cover" />
          </div>
          <p className="truncate text-sm font-semibold text-neutral-900">{tenantName}</p>
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
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 transition-colors"
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
        className={`fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-neutral-200 bg-white transition-transform duration-250 ease-out md:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Navigation drawer"
      >
        {/* Drawer header */}
        <div className="flex items-center gap-2.5 border-b border-neutral-100 px-4 py-4 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 overflow-hidden shrink-0">
            <img src="/logo-28.png" alt="Forge" className="h-7 w-7 object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900">{tenantName}</p>
            <p className="text-[11px] text-neutral-400 capitalize">{role}</p>
          </div>
          <button
            onClick={close}
            aria-label="Close navigation"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">

          <div>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">My Work</p>
            <div className="space-y-0.5">
              <NavLink href={`/${slug}`} icon="🏠" label="Home" onClick={close} />
              <NavLink href={`/${slug}/assigned`} icon="📌" label="Assigned to Me" onClick={close} />
              <NavLink href={`/${slug}/watching`} icon="👁" label="Watching" onClick={close} />
              <NavLink href={`/${slug}/inbox`} icon="📥" label="Inbox" badge={unreadCount > 0 ? unreadCount : undefined} onClick={close} />
            </div>
          </div>

          <div>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Workspace</p>
            <div className="space-y-0.5">
              <NavLink href={`/${slug}/board`} icon="🏃" label="Board" badge={visibleProjects > 1 ? visibleProjects : undefined} badgeColor="indigo" onClick={close} />
              <NavLink href={`/${slug}/issues`} icon="🐛" label="Issues" onClick={close} />
              <NavLink href={`/${slug}/projects`} icon="📋" label="Projects" onClick={close} />
              <NavLink href={`/${slug}/roadmap`} icon="🗺️" label="Roadmap" onClick={close} />
              <NavLink href={`/${slug}/timeline`} icon="📅" label="Timeline" onClick={close} />
              <NavLink href={`/${slug}/calendar`} icon="🗓️" label="Calendar" onClick={close} />
              <NavLink href={`/${slug}/workload`} icon="👥" label="Workload" onClick={close} />
              {flags.ops_layer && <NavLink href={`/${slug}/time`} icon="⏱️" label="My Time" onClick={close} />}
            </div>
          </div>

          <div>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Intelligence</p>
            <div className="space-y-0.5">
              <NavLink href={`/${slug}/reports`} icon="📊" label="Reports" onClick={close} />
              <NavLink href={`/${slug}/think-tank`} icon="💡" label="Think Tank" onClick={close} />
              <NavLink href={`/${slug}/customers`} icon="🏢" label="Customers" onClick={close} />
              <NavLink href={`/${slug}/stakeholder`} icon="📈" label="Stakeholder" onClick={close} />
              <NavLink href={`/${slug}/changelog`} icon="📋" label="Changelog" onClick={close} />
            </div>
          </div>

          <div>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">You</p>
            <div className="space-y-0.5">
              <NavLink href={`/${slug}/settings`} icon="🔔" label="Preferences" onClick={close} />
              <NavLink href={`/${slug}/spaces`} icon="📚" label="Spaces" onClick={close} />
              <NavLink href={`/${slug}/docs`} icon="📖" label="Help Docs" onClick={close} />
              <NavLink href={`/${slug}/support`} icon="🎫" label="Get Support" onClick={close} />
            </div>
          </div>

          {/* Admin and Super Admin sections intentionally omitted on mobile —
              those pages require a desktop viewport to be usable. */}
        </nav>

        {/* User footer */}
        <div className="shrink-0 border-t border-neutral-100 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-neutral-800">{email}</p>
              <p className="text-[11px] text-neutral-400 capitalize">{role}</p>
            </div>
          </div>
          <form action="/api/auth/signout" method="POST" className="mt-2">
            <button type="submit" className="w-full rounded-lg px-3 py-1.5 text-left text-xs text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800 transition">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
