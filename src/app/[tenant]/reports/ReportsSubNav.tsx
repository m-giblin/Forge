"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS = [
  {
    label: null,
    items: [
      { href: "/reports", label: "Overview", icon: "◉", exact: true },
    ],
  },
  {
    label: "Sprint",
    items: [
      { href: "/reports/burndown", label: "Burndown", icon: "🔻" },
      { href: "/reports/velocity", label: "Velocity", icon: "📈" },
      { href: "/reports/sprint-retro", label: "Sprint Retro", icon: "🔍" },
      { href: "/reports/overcommitment", label: "Overcommitment", icon: "👥" },
      { href: "/reports/estimate-accuracy", label: "Est. Accuracy", icon: "📊" },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/reports/capacity", label: "Capacity", icon: "⚡" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { href: "/reports/cycle-time", label: "Cycle Time", icon: "⏱", pro: true },
      { href: "/reports/control-chart", label: "Control Chart", icon: "📉", pro: true },
      { href: "/reports/aging", label: "Issue Aging", icon: "⏳", pro: true },
      { href: "/reports/cfd", label: "Cumulative Flow", icon: "🌊", pro: true },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/reports/custom", label: "Custom Builder", icon: "🛠" },
      { href: "/reports/scheduled", label: "Scheduled", icon: "📬", pro: true },
    ],
  },
] as const;

export default function ReportsSubNav({ slug }: { slug: string }) {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    const full = `/${slug}${href}`;
    if (exact) return pathname === full;
    return pathname === full || pathname.startsWith(`${full}/`);
  }

  return (
    <aside
      className="w-48 shrink-0 border-l-[3px] border-[var(--fw-rust)] px-2 py-5 flex flex-col overflow-y-auto"
      style={{ background: `linear-gradient(165deg, var(--fw-sidebar-1) 0%, var(--fw-sidebar-2) 55%, var(--fw-sidebar-3) 100%)` }}
    >
      <Link
        href={`/${slug}`}
        className="mb-3 flex items-center gap-1.5 px-2 text-[11px] font-semibold text-[var(--fw-text-dim)] hover:text-[var(--fw-text-bright)] transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to workspace
      </Link>
      <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-widest text-[var(--fw-text-dimmer)]">Reports</p>
      {GROUPS.map((group, gi) => (
        <div key={gi} className={gi > 0 ? "mt-4" : ""}>
          {group.label && (
            <p className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-widest text-[var(--fw-text-dimmer)]">
              {group.label}
            </p>
          )}
          {group.items.map((item) => {
            const active = isActive(item.href, "exact" in item ? item.exact : false);
            const pro = "pro" in item ? item.pro : false;
            return (
              <Link
                key={item.href}
                href={`/${slug}${item.href}`}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-[var(--fw-rust)]/20 text-[var(--fw-text-bright)]"
                    : "text-[var(--fw-text-dim)] hover:bg-white/5 hover:text-[var(--fw-text-bright)]"
                }`}
              >
                <span className="text-sm leading-none">{item.icon}</span>
                <span className="flex-1 truncate">{item.label}</span>
                {pro && (
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold ${active ? "bg-[var(--fw-rust)] text-[var(--fw-text-bright)]" : "bg-white/10 text-[var(--fw-text-dim)]"}`}>
                    PRO
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
