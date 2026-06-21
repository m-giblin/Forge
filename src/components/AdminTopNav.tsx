"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS = [
  { label: "Workspace",      seg: "",                     },
  { label: "Members",        seg: "members",              },
  { label: "Projects",       seg: "projects",             },
  { label: "Fields",         seg: "fields",               },
  { label: "API Keys",       seg: "api-keys",             },
  { label: "Import",         seg: "import",               },
  { label: "Notifications",  seg: "notifications",        },
  { label: "SDK",            seg: "integration",          },
  { label: "GitHub",         seg: "settings/git",         },
  { label: "Webhooks",       seg: "settings/webhooks",    },
  { label: "Slack / Teams",  seg: "settings/chat",        },
  { label: "Automations",    seg: "settings/automations", },
  { label: "Permissions",    seg: "settings/permissions", },
  { label: "SLA",            seg: "settings/sla",         },
  { label: "SSO",            seg: "settings/sso",         },
  { label: "Security",       seg: "settings/security",    },
  { label: "AI Settings",    seg: "settings/ai",          },
  { label: "AI Usage",       seg: "usage",                },
  { label: "Audit Log",      seg: "activity",             },
  { label: "Think Tank",     seg: "think-tank",           },
];

export default function AdminTopNav({ slug }: { slug: string }) {
  const pathname = usePathname();

  function isActive(seg: string) {
    const href = `/${slug}/admin${seg ? `/${seg}` : ""}`;
    if (seg === "") return pathname === `/${slug}/admin`;
    return pathname.startsWith(href);
  }

  return (
    <nav className="border-b border-neutral-200 bg-white">
      <div className="flex overflow-x-auto scrollbar-none px-1">
        {GROUPS.map((item) => {
          const active = isActive(item.seg);
          return (
            <Link
              key={item.seg}
              href={`/${slug}/admin${item.seg ? `/${item.seg}` : ""}`}
              className={[
                "flex shrink-0 items-center whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                active
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
