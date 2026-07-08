"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef } from "react";
import { createPortal } from "react-dom";

// DEV-ONLY: collapsible groups with info tooltips.
// Remove this flag (and the collapse/tooltip UI below) before launch.
const DEV_COLLAPSIBLE = process.env.NODE_ENV === "development";

const NAV = [
  {
    group: "Overview",
    info: "Dashboard metrics, engineering health scores, security posture, audit log, and AI token usage across your workspace.",
    items: [
      { seg: "", label: "Dashboard", icon: "⬡" },
      { seg: "engineering-health", label: "Eng Health", icon: "📈" },
      { seg: "security", label: "Security", icon: "🛡️" },
      { seg: "activity", label: "Audit Log", icon: "📋" },
      { seg: "usage", label: "AI Usage", icon: "📊" },
    ],
  },
  {
    group: "Team",
    info: "Manage workspace members and their roles, organize projects, configure custom fields and labels, and view team workload and capacity.",
    items: [
      { seg: "members", label: "Members", icon: "👥" },
      { seg: "roles", label: "Roles", icon: "🔐" },
      { seg: "projects", label: "Projects", icon: "📁" },
      { seg: "fields", label: "Fields & Labels", icon: "🏷" },
      { seg: "workload", label: "Workload", icon: "📊" },
      { seg: "timesheets", label: "Timesheets ⭐", icon: "📋" },
      { seg: "time-off", label: "Time Off ⭐", icon: "🏖" },
      { seg: "rates", label: "Rates ⭐", icon: "💰" },
    ],
  },
  {
    group: "Integrations",
    info: "Connect GitHub for code sync, Slack or Teams for notifications, configure webhooks, embed the SDK, and manage API keys.",
    items: [
      { seg: "settings/git", label: "GitHub", icon: "🐙" },
      { seg: "settings/chat", label: "Slack / Teams", icon: "💬" },
      { seg: "settings/webhooks", label: "Webhooks", icon: "⚡" },
      { seg: "integration", label: "SDK & Embed", icon: "🔌" },
      { seg: "api-keys", label: "API Keys", icon: "🔑" },
    ],
  },
  {
    group: "Automation",
    info: "Set up issue automations and workflow rules, define SLA policies with escalation timers, and control notification delivery.",
    items: [
      { seg: "settings/automations", label: "Automations", icon: "⚙️" },
      { seg: "settings/sla", label: "SLA Policies", icon: "⏱️" },
      { seg: "notifications", label: "Notifications", icon: "🔔" },
    ],
  },
  {
    group: "Security",
    info: "Configure SSO and SAML authentication, set member permission levels, and enforce workspace security policies.",
    items: [
      { seg: "settings/sso", label: "SSO / SAML", icon: "🛡" },
      { seg: "settings/permissions", label: "Permissions", icon: "🚦" },
      { seg: "settings/security", label: "Security", icon: "🔒" },
    ],
  },
  {
    group: "AI & Data",
    info: "Choose your AI provider and model settings, read release notes, bulk-import issues, and manage your team's support queue.",
    items: [
      { seg: "settings/ai", label: "AI Settings", icon: "✨" },
      { seg: "release-notes", label: "Release Notes", icon: "📝" },
      { seg: "import", label: "Import Issues", icon: "📥" },
      { seg: "export", label: "Export Data", icon: "📤" },
      { seg: "support", label: "Support Queue", icon: "🎧" },
      { seg: "wiki-insights", label: "Wiki Insights", icon: "🔍" },
    ],
  },
  {
    group: "Subscription",
    info: "View your current plan, manage which features are active in your workspace, and upgrade your subscription.",
    items: [
      { seg: "features", label: "Features & Plan", icon: "✦" },
    ],
  },
  {
    group: "Products",
    info: "Access Think Tank for idea management and OKRs for goal tracking across your workspace.",
    items: [
      { seg: "think-tank", label: "Think Tank", icon: "💡" },
      { seg: "okrs", label: "OKRs", icon: "🎯" },
    ],
  },
];

function InfoTooltip({ text }: { text: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  function show() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ top: r.top, left: r.right + 8 });
  }

  return (
    <span
      ref={ref}
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
    >
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 text-[9px] font-bold text-neutral-400 hover:border-indigo-300 hover:text-indigo-500 cursor-default select-none leading-none">
        i
      </span>
      {pos && typeof window !== "undefined" && createPortal(
        <span
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-52 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[11px] leading-relaxed text-neutral-600 shadow-lg pointer-events-none"
        >
          {text}
        </span>,
        document.body
      )}
    </span>
  );
}

export default function AdminSidebar({ slug }: { slug: string }) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");

  // DEV-ONLY: track which groups are open. Default all collapsed.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  function isActive(seg: string) {
    const href = `/${slug}/admin${seg ? `/${seg}` : ""}`;
    if (seg === "") return pathname === `/${slug}/admin`;
    return pathname.startsWith(href);
  }

  function toggleGroup(group: string) {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  }

  // If a group has an active item, force it open
  function isGroupOpen(section: (typeof NAV)[number]) {
    if (!DEV_COLLAPSIBLE) return true;
    if (openGroups[section.group] !== undefined) return openGroups[section.group];
    // Auto-open if an item is active
    return section.items.some((i) => isActive(i.seg));
  }

  const needle = search.trim().toLowerCase();
  const filteredNav = needle
    ? NAV.map((s) => ({ ...s, items: s.items.filter((i) => i.label.toLowerCase().includes(needle)) })).filter((s) => s.items.length > 0)
    : NAV;

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto border-r border-neutral-200 bg-white px-3 py-5">
      <div className="px-2 pb-1 border-b border-neutral-100">
        <p className="text-xs font-bold text-neutral-900">Admin Settings</p>
        <p className="text-[11px] text-neutral-400 mt-0.5">Workspace configuration</p>
      </div>

      {/* Search box */}
      <div className="relative -mt-1">
        <svg className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" strokeWidth="2" />
          <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          placeholder="Filter settings…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-1.5 pl-7 pr-3 text-xs text-neutral-700 outline-none placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2 top-1.5 text-neutral-400 hover:text-neutral-600 text-sm">✕</button>
        )}
      </div>

      {filteredNav.map((section) => {
        const open = isGroupOpen(section);
        return (
          <div key={section.group}>
            {DEV_COLLAPSIBLE ? (
              <button
                onClick={() => toggleGroup(section.group)}
                className="flex w-full items-center gap-1 px-2 mb-1 group"
              >
                <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 group-hover:text-neutral-600 transition-colors flex-1 text-left">
                  {section.group}
                </span>
                <InfoTooltip text={section.info} />
                <svg
                  className={`ml-1 h-2.5 w-2.5 text-neutral-300 group-hover:text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path d="M6 9l6 6 6-6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : (
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                {section.group}
              </p>
            )}

            {open && (
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.seg);
                  return (
                    <Link
                      key={item.seg}
                      href={`/${slug}/admin${item.seg ? `/${item.seg}` : ""}`}
                      onClick={() => setSearch("")}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                        active
                          ? "bg-indigo-50 text-indigo-700 font-medium"
                          : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                      }`}
                    >
                      <span className="text-base leading-none">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* External links */}
      <div className="mt-auto pt-2 border-t border-neutral-100">
        <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Public</p>
        <a
          href={`/feedback/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
        >
          <span className="text-base leading-none">💬</span>
          <span className="truncate">Feedback Portal ↗</span>
        </a>
        <a
          href={`/${slug}/changelog`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
        >
          <span className="text-base leading-none">📋</span>
          <span className="truncate">Public Changelog ↗</span>
        </a>
      </div>
    </nav>
  );
}
