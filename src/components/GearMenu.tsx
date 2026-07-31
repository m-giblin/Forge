"use client";

import { useEffect, useRef, useState } from "react";
import SidebarNavItem from "./SidebarNavItem";

type Props = {
  slug: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  rbacEnabled: boolean;
  figmaUrl: string | null;
};

export default function GearMenu({ slug, isAdmin, isSuperAdmin, rbacEnabled, figmaUrl }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="More options"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--fw-text-dim)] hover:bg-[var(--fw-sidebar-2)] hover:text-[var(--fw-text-bright)] transition-colors"
      >
        <span className="text-base leading-none">⚙️</span>
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-lg border border-[var(--fw-sidebar-border)] py-2 shadow-[0_12px_24px_rgba(0,0,0,0.5)]"
          style={{
            background: `linear-gradient(165deg, var(--fw-sidebar-1) 0%, var(--fw-sidebar-2) 55%, var(--fw-sidebar-3) 100%)`,
          }}
        >
          <div className="max-h-[70vh] overflow-y-auto px-2 space-y-0.5">
            <SidebarNavItem href={`/${slug}/settings`} icon="🔔" label="Preferences" onClick={close} dense />
            <SidebarNavItem href={`/${slug}/spaces`} icon="📚" label="Spaces" onClick={close} dense />
            <SidebarNavItem href={`/${slug}/docs`} icon="📖" label="Help Docs" onClick={close} dense />
            <SidebarNavItem href={`/${slug}/support`} icon="🎫" label="Get Support" onClick={close} dense />

            <div className="my-1.5 h-px bg-[var(--fw-sidebar-border)]" />

            <SidebarNavItem href={`/${slug}/backlog-refinement`} icon="🧮" label="Backlog Refinement" onClick={close} dense />
            <SidebarNavItem href={`/${slug}/estimation-poker`} icon="🃏" label="Estimation Poker" onClick={close} dense />
            <SidebarNavItem href={`/${slug}/sprint-planning`} icon="🏃" label="Sprint Planning" onClick={close} dense />
            <SidebarNavItem href={`/${slug}/pi-planning`} icon="🗺️" label="PI Planning" onClick={close} dense />
            <SidebarNavItem href={`/${slug}/advanced-search`} icon="🔎" label="Advanced Search" onClick={close} dense />
            <SidebarNavItem href={`/${slug}/admin/intake-forms`} icon="📝" label="Intake Forms" onClick={close} dense />
            <SidebarNavItem href={`/${slug}/admin/fields`} icon="📄" label="Issue Templates" onClick={close} dense />
            {figmaUrl && (
              <a
                href={figmaUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
                className="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors border-l-2 border-transparent text-[var(--fw-text-dim)] hover:bg-[var(--fw-sidebar-2)]/60 hover:text-[var(--fw-text-bright)]"
              >
                <span className="text-base leading-none w-4 text-center">🎨</span>
                <span className="flex-1 truncate">Figma</span>
                <span className="shrink-0 text-xs opacity-60">↗</span>
              </a>
            )}

            {isAdmin && (
              <>
                <div className="my-1.5 h-px bg-[var(--fw-sidebar-border)]" />
                <SidebarNavItem href={`/${slug}/admin`} icon="⚙️" label="Settings" onClick={close} dense />
                {rbacEnabled && (
                  <SidebarNavItem href={`/${slug}/admin/roles`} icon="🔐" label="Roles" onClick={close} dense />
                )}
              </>
            )}
            {isSuperAdmin && (
              <SidebarNavItem href="/admin" icon="⚡" label="Super Admin" onClick={close} dense />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
