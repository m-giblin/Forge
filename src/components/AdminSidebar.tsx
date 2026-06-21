"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  {
    group: "Overview",
    items: [{ seg: "", label: "Workspace", icon: "▣" }],
  },
  {
    group: "People",
    items: [
      { seg: "members", label: "Members", icon: "👥" },
      { seg: "projects", label: "Projects & Teams", icon: "📋" },
    ],
  },
  {
    group: "Configuration",
    items: [
      { seg: "fields", label: "Fields & Categories", icon: "🏷" },
      { seg: "api-keys", label: "API Keys", icon: "🔑" },
      { seg: "import", label: "Import Issues", icon: "📥" },
      { seg: "think-tank", label: "Think Tank", icon: "💡" },
      { seg: "notifications", label: "Notifications", icon: "🔔" },
      { seg: "integration", label: "SDK Integration", icon: "🔌" },
    ],
  },
  {
    group: "Integrations",
    items: [
      { seg: "settings/git", label: "GitHub", icon: "🐙" },
      { seg: "settings/webhooks", label: "Webhooks", icon: "⚡" },
      { seg: "settings/chat", label: "Slack / Teams", icon: "💬" },
      { seg: "settings/automations", label: "Automations", icon: "🤖" },
    ],
  },
  {
    group: "Security",
    items: [
      { seg: "settings/sso", label: "SSO", icon: "🔐" },
      { seg: "settings/permissions", label: "Permissions", icon: "🛡" },
      { seg: "settings/sla", label: "SLA Policies", icon: "📊" },
      { seg: "settings/security", label: "Security", icon: "🔒" },
    ],
  },
  {
    group: "Monitoring",
    items: [
      { seg: "settings/ai", label: "AI Settings", icon: "✨" },
      { seg: "usage", label: "AI Usage", icon: "📈" },
      { seg: "activity", label: "Audit Log", icon: "📜" },
    ],
  },
  {
    group: "Support",
    items: [{ seg: "support", label: "Get Support", icon: "🎫" }],
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
    <nav className="flex w-52 shrink-0 flex-col gap-4 overflow-y-auto py-1">
      {NAV.map((section) => (
        <div key={section.group}>
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
            {section.group}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(item.seg);
              return (
                <Link
                  key={item.seg}
                  href={`/${slug}/admin${item.seg ? `/${item.seg}` : ""}`}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
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
    </nav>
  );
}
