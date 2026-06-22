"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  {
    group: "Overview",
    items: [
      { seg: "", label: "Dashboard", icon: "⬡" },
      { seg: "engineering-health", label: "Eng Health", icon: "📈" },
      { seg: "activity", label: "Audit Log", icon: "📋" },
      { seg: "usage", label: "AI Usage", icon: "📊" },
    ],
  },
  {
    group: "Team",
    items: [
      { seg: "members", label: "Members", icon: "👥" },
      { seg: "roles", label: "Roles", icon: "🔐" },
      { seg: "projects", label: "Projects", icon: "📁" },
      { seg: "fields", label: "Fields & Labels", icon: "🏷" },
    ],
  },
  {
    group: "Integrations",
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
    items: [
      { seg: "settings/automations", label: "Automations", icon: "⚙️" },
      { seg: "settings/sla", label: "SLA Policies", icon: "⏱️" },
      { seg: "notifications", label: "Notifications", icon: "🔔" },
    ],
  },
  {
    group: "Security",
    items: [
      { seg: "settings/sso", label: "SSO / SAML", icon: "🛡" },
      { seg: "settings/permissions", label: "Permissions", icon: "🚦" },
      { seg: "settings/security", label: "Security", icon: "🔒" },
    ],
  },
  {
    group: "AI & Data",
    items: [
      { seg: "settings/ai", label: "AI Settings", icon: "✨" },
      { seg: "release-notes", label: "Release Notes", icon: "📝" },
      { seg: "import", label: "Import Issues", icon: "📥" },
      { seg: "support", label: "Support Queue", icon: "🎧" },
    ],
  },
  {
    group: "Products",
    items: [
      { seg: "think-tank", label: "Think Tank", icon: "💡" },
    ],
  },
];

export default function AdminSidebar({ slug }: { slug: string }) {
  const pathname = usePathname();

  function isActive(seg: string) {
    const href = `/${slug}/admin${seg ? `/${seg}` : ""}`;
    if (seg === "") return pathname === `/${slug}/admin`;
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-5 overflow-y-auto border-r border-neutral-200 bg-white px-3 py-5">
      <div className="px-2 pb-1 border-b border-neutral-100">
        <p className="text-xs font-bold text-neutral-900">Admin Settings</p>
        <p className="text-[11px] text-neutral-400 mt-0.5">Workspace configuration</p>
      </div>
      {NAV.map((section) => (
        <div key={section.group}>
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
            {section.group}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(item.seg);
              return (
                <Link
                  key={item.seg}
                  href={`/${slug}/admin${item.seg ? `/${item.seg}` : ""}`}
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
        </div>
      ))}

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
