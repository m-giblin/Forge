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
      { href: "/reports/aging", label: "Issue Aging", icon: "⏳", pro: true },
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
    <aside className="w-48 shrink-0 border-r border-neutral-200 bg-white px-2 py-5 flex flex-col">
      <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">Reports</p>
      {GROUPS.map((group, gi) => (
        <div key={gi} className={gi > 0 ? "mt-4" : ""}>
          {group.label && (
            <p className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-widest text-neutral-400">
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
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                <span className="text-sm leading-none">{item.icon}</span>
                <span className="flex-1 truncate">{item.label}</span>
                {pro && (
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold ${active ? "bg-indigo-200 text-indigo-700" : "bg-indigo-100 text-indigo-500"}`}>
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
