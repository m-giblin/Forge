"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { seg: "members", label: "Members" },
  { seg: "projects", label: "Projects & teams" },
  { seg: "fields", label: "Fields & categories" },
  { seg: "api-keys", label: "API keys" },
  { seg: "integration", label: "Integration" },
  { seg: "notifications", label: "Notifications" },
  { seg: "import", label: "Import issues" },
  { seg: "think-tank", label: "Think Tank" },
  { seg: "settings/ai", label: "AI settings" },
  { seg: "activity", label: "Activity log" },
];

export default function AdminSidebar({ slug }: { slug: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex w-52 shrink-0 flex-col gap-0.5">
      {SECTIONS.map((s) => {
        const href = `/${slug}/admin/${s.seg}`;
        const active = pathname === href;
        return (
          <Link
            key={s.seg}
            href={href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
