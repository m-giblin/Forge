"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: string; exact?: boolean; badge?: boolean };

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [
      { href: "/admin",         label: "Dashboard",    icon: "▤", exact: true },
      { href: "/admin/tenants", label: "Tenants",      icon: "⬡" },
      { href: "/admin/ai",      label: "AI Analytics", icon: "✦" },
    ],
  },
  {
    section: "Management",
    items: [
      { href: "/admin/flags",       label: "Feature Access", icon: "⚑" },
      { href: "/admin/flags/plans", label: "  Plans",        icon: "◈" },
      { href: "/admin/support",    label: "Support",        icon: "✉", badge: true },
      { href: "/admin/compliance", label: "Compliance",     icon: "☰" },
    ],
  },
  {
    section: "Platform",
    items: [
      { href: "/admin/audit",   label: "Audit Log", icon: "◷" },
      { href: "/admin/admins",  label: "Admins",    icon: "◉" },
    ],
  },
];

export default function AdminSidebar({ openTickets }: { openTickets?: number }) {
  const pathname = usePathname();

  return (
    <aside style={{
      width: 220,
      background: "#fff",
      borderRight: "1px solid #e5e7eb",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      height: "100vh",
      position: "sticky",
      top: 0,
    }}>
      {/* Brand */}
      <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Image src="/logo-64.png" alt="Forge Worx" width={36} height={36} style={{ borderRadius: 8, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#111827", lineHeight: 1.2 }}>Forge Worx</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>Platform Admin</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }}>
        {NAV.map((group) => (
          <div key={group.section} style={{ marginBottom: 4 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, color: "#cbd5e1",
              letterSpacing: ".1em", textTransform: "uppercase",
              padding: "10px 10px 3px",
            }}>
              {group.section}
            </div>
            {group.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 10px", borderRadius: 7,
                    color: active ? "#4f46e5" : "#6b7280",
                    background: active ? "#ede9fe" : "transparent",
                    fontWeight: active ? 600 : 500,
                    fontSize: 12,
                    textDecoration: "none",
                    marginBottom: 1,
                    transition: "all .12s",
                  }}
                >
                  <span style={{ width: 16, textAlign: "center", fontSize: 13, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && openTickets && openTickets > 0 && (
                    <span style={{
                      background: "#ef4444", color: "#fff",
                      fontSize: 9, fontWeight: 700,
                      padding: "1px 5px", borderRadius: 9,
                    }}>{openTickets}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: "10px 8px", borderTop: "1px solid #f1f5f9" }}>
        <Link
          href="/"
          style={{
            display: "block", padding: "7px 10px", borderRadius: 7,
            fontSize: 11, color: "#6b7280", textDecoration: "none",
            fontWeight: 500,
          }}
        >
          ← Exit to workspace
        </Link>
      </div>
    </aside>
  );
}
