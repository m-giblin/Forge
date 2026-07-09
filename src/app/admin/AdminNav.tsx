"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/admin", label: "Platform Health", exact: true },
  { href: "/admin/tenants", label: "Tenants" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/flags", label: "Feature Flags" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/permissions", label: "Permissions" },
  { href: "/admin/compliance", label: "Compliance" },
  { href: "/admin/audit", label: "Audit" },
  { href: "/admin/admins", label: "Admins" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="ml-3 flex items-center gap-1">
      {NAV_LINKS.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-neutral-800 text-white"
                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
