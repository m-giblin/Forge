"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  href?: string;
  icon: string;
  label: string;
  badge?: number;
  badgeColor?: "red" | "rust";
  soon?: boolean;
  onClick?: () => void;
  dense?: boolean;
};

export default function SidebarNavItem({
  href,
  icon,
  label,
  badge,
  badgeColor = "red",
  soon = false,
  onClick,
  dense = false,
}: Props) {
  const pathname = usePathname();
  const isActive =
    !soon &&
    !!href &&
    (pathname === href || (href !== `/${href.split("/")[1]}` && pathname.startsWith(`${href}/`)));

  const badgeCls = badgeColor === "rust" ? "bg-[var(--fw-rust)]" : "bg-red-500";
  const py = dense ? "py-2" : "py-2.5";

  if (soon || !href) {
    return (
      <div
        className={`flex items-center gap-3 rounded-md px-2.5 ${py} text-sm cursor-default text-[var(--fw-text-dimmer)] border-l-2 border-transparent`}
        title="Coming soon"
      >
        <span className="text-base leading-none w-4 text-center opacity-60">{icon}</span>
        <span className="flex-1 truncate opacity-70">{label}</span>
        <span className="shrink-0 rounded-full border border-[var(--fw-text-dimmer)]/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--fw-text-dimmer)]">
          Soon
        </span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-md px-2.5 ${py} text-sm transition-colors border-l-2 ${
        isActive
          ? "bg-[var(--fw-sidebar-2)] text-[var(--fw-text-bright)] border-[var(--fw-rust)]"
          : "text-[var(--fw-text-dim)] border-transparent hover:bg-[var(--fw-sidebar-2)]/60 hover:text-[var(--fw-text-bright)]"
      }`}
    >
      <span className="text-base leading-none w-4 text-center">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge != null && (
        <span className={`flex h-4 min-w-4 items-center justify-center rounded-full ${badgeCls} px-1 text-[10px] font-bold text-white`}>
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}
