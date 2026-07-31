import SidebarNavItem from "./SidebarNavItem";

const NAV = [
  {
    group: "Overview",
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
    items: [
      { seg: "members", label: "Members", icon: "👥" },
      { seg: "roles", label: "Roles", icon: "🔐" },
      { seg: "projects", label: "Projects", icon: "📁" },
      { seg: "guest-access", label: "Guest Access", icon: "🔗" },
      { seg: "intake-forms", label: "Intake Forms", icon: "📝" },
      { seg: "fields", label: "Fields & Labels", icon: "🏷" },
      { seg: "workload", label: "Workload", icon: "📊" },
      { seg: "timesheets", label: "Timesheets ⭐", icon: "📋" },
      { seg: "time-off", label: "Time Off ⭐", icon: "🏖" },
      { seg: "rates", label: "Rates ⭐", icon: "💰" },
    ],
  },
  {
    group: "Integrations",
    items: [
      { seg: "settings/git", label: "GitHub", icon: "🐙" },
      { seg: "settings/chat", label: "Slack / Teams", icon: "💬" },
      { seg: "settings/figma", label: "Figma", icon: "🎨" },
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
      { seg: "recurring", label: "Recurring Issues", icon: "🔁" },
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
      { seg: "export", label: "Export Data", icon: "📤" },
      { seg: "support", label: "Support Queue", icon: "🎧" },
      { seg: "wiki-insights", label: "Wiki Insights", icon: "🔍" },
    ],
  },
  {
    group: "Subscription",
    items: [
      { seg: "features", label: "Features & Plan", icon: "✦" },
      { seg: "usage-seats", label: "Usage & Seats", icon: "📐" },
    ],
  },
  {
    group: "Products",
    items: [
      { seg: "think-tank", label: "Think Tank", icon: "💡" },
      { seg: "okrs", label: "OKRs", icon: "🎯" },
    ],
  },
] as const;

/** Renders inside the same dark `<nav>` slot the normal workspace nav uses — swapped in for `/[tenant]/admin/*` routes. */
export default function AdminNavGroups({ slug }: { slug: string }) {
  return (
    <>
      <div>
        <div className="space-y-0.5">
          <SidebarNavItem href={`/${slug}`} icon="←" label={`Back to ${slug}`} />
        </div>
      </div>

      {NAV.map((section) => (
        <div key={section.group}>
          <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--fw-text-dimmer)]">
            {section.group}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <SidebarNavItem
                key={item.seg}
                href={`/${slug}/admin${item.seg ? `/${item.seg}` : ""}`}
                icon={item.icon}
                label={item.label}
              />
            ))}
          </div>
        </div>
      ))}

      <div>
        <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--fw-text-dimmer)]">Public</p>
        <div className="space-y-0.5">
          <a
            href={`/feedback/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-md border-l-2 border-transparent px-2.5 py-2.5 text-sm text-[var(--fw-text-dim)] transition-colors hover:bg-[var(--fw-sidebar-2)]/60 hover:text-[var(--fw-text-bright)]"
          >
            <span className="w-4 text-center text-base leading-none">💬</span>
            <span className="flex-1 truncate">Feedback Portal ↗</span>
          </a>
          <a
            href={`/${slug}/changelog`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-md border-l-2 border-transparent px-2.5 py-2.5 text-sm text-[var(--fw-text-dim)] transition-colors hover:bg-[var(--fw-sidebar-2)]/60 hover:text-[var(--fw-text-bright)]"
          >
            <span className="w-4 text-center text-base leading-none">📋</span>
            <span className="flex-1 truncate">Public Changelog ↗</span>
          </a>
        </div>
      </div>
    </>
  );
}
