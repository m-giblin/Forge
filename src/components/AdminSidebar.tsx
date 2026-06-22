"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_GROUPS = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { id: "workspace", label: "Workspace", icon: "🏢", href: "/admin" },
      { id: "audit", label: "Audit Log", icon: "📋", href: "/admin/activity" },
    ],
  },
  {
    id: "team",
    label: "Team",
    items: [
      { id: "members", label: "Members", icon: "👥", href: "/admin/members" },
      { id: "roles", label: "Roles", icon: "🔐", href: "/admin/roles" },
    ],
  },
  {
    id: "projects",
    label: "Projects & Work",
    items: [
      { id: "projects", label: "Projects", icon: "📁", href: "/admin/projects" },
      { id: "fields", label: "Fields", icon: "🗂️", href: "/admin/fields" },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    items: [
      { id: "github", label: "GitHub", icon: "🐙", href: "/admin/settings/git" },
      { id: "webhooks", label: "Webhooks", icon: "⚡", href: "/admin/settings/webhooks" },
      { id: "chat", label: "Slack / Teams", icon: "💬", href: "/admin/settings/chat" },
      { id: "sdk", label: "SDK & Import", icon: "📦", href: "/admin/import" },
    ],
  },
  {
    id: "automation",
    label: "Automation",
    items: [
      { id: "automations", label: "Automations", icon: "⚙️", href: "/admin/settings/automations" },
      { id: "notifications", label: "Notifications", icon: "🔔", href: "/admin/notifications" },
    ],
  },
  {
    id: "developer",
    label: "Developer",
    items: [
      { id: "api_keys", label: "API Keys", icon: "🗝️", href: "/admin/api-keys" },
    ],
  },
];

export default function AdminSidebar({ slug }: { slug: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  function isActive(href: string): boolean {
    const path = pathname.replace(`/${slug}`, "");
    return path === href || path.startsWith(href + "/");
  }

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-neutral-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-neutral-100 px-4 py-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Admin</div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {ADMIN_GROUPS.map((group) => {
          const isCollapsed = collapsed[group.id];
          const groupActive = group.items.some((i) => isActive(`/${slug}${i.href}`));

          return (
            <div key={group.id} className="mb-2">
              <button
                onClick={() => setCollapsed((p) => ({ ...p, [group.id]: !p[group.id] }))}
                className="w-full flex items-center gap-1 px-2 py-1 mb-0.5 group transition"
              >
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest transition ${
                    groupActive ? "text-indigo-600" : "text-neutral-400 group-hover:text-neutral-600"
                  }`}
                >
                  {group.label}
                </span>
                <div className="flex-1" />
                <span className={`text-neutral-400 text-[10px] transition ${isCollapsed ? "rotate-0" : "rotate-90"}`}>
                  ›
                </span>
              </button>

              {!isCollapsed &&
                group.items.map((item) => {
                  const active = isActive(`/${slug}${item.href}`);
                  return (
                    <Link
                      key={item.id}
                      href={`/${slug}${item.href}`}
                      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition mb-0.5 ${
                        active
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                      }`}
                    >
                      <span className="w-4 text-center">{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
            </div>
          );
        })}
      </nav>

      {/* Search footer */}
      <div className="shrink-0 p-2 border-t border-neutral-100">
        <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-neutral-200 text-xs text-neutral-400 hover:border-neutral-300 hover:text-neutral-600 hover:bg-neutral-50 transition">
          <span>🔍</span>
          <span className="flex-1 text-left">Search settings</span>
          <kbd className="text-[9px] font-mono bg-neutral-100 border border-neutral-200 px-1 rounded">⌘K</kbd>
        </button>
      </div>
    </aside>
  );
}
