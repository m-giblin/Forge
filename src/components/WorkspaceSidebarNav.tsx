"use client";

import { usePathname } from "next/navigation";
import SidebarSearchButton from "./SidebarSearchButton";
import SidebarNavItem from "./SidebarNavItem";
import AdminNavGroups from "./AdminNavGroups";

/**
 * Swaps the sidebar's search-bar row and nav groups between the normal
 * workspace nav and the Admin nav, based on the LIVE pathname — this must be
 * a client component (usePathname, not a server-computed boolean) because
 * Next.js reuses this shared layout's already-rendered output across
 * client-side <Link> navigations between sibling routes under /[tenant]; a
 * server-side path check here would go stale after the first load.
 */
export default function WorkspaceSidebarNav({
  slug, unreadCount, visibleProjects, opsLayer,
}: {
  slug: string; unreadCount: number; visibleProjects: number; opsLayer: boolean;
}) {
  const pathname = usePathname();
  const isAdminSection = pathname.startsWith(`/${slug}/admin`);

  return (
    <>
      {!isAdminSection && (
        <div className="shrink-0 px-2 py-2 border-b border-[var(--fw-sidebar-border)]">
          <SidebarSearchButton />
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4 min-w-0">
        {isAdminSection ? (
          <AdminNavGroups slug={slug} />
        ) : (
          <>
            <div>
              <div className="space-y-0.5">
                <SidebarNavItem href={`/${slug}`} icon="🏠" label="Home" />
              </div>
            </div>

            {/* Execution */}
            <div>
              <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--fw-text-dimmer)]">Execution</p>
              <div className="space-y-0.5">
                <SidebarNavItem href={`/${slug}/assigned`} icon="📌" label="My Work" />
                <SidebarNavItem href={`/${slug}/code-review`} icon="🔀" label="Code Review" />
                <SidebarNavItem href={`/${slug}/watching`} icon="👁" label="Watching" />
                <SidebarNavItem href={`/${slug}/inbox`} icon="📥" label="Inbox" badge={unreadCount > 0 ? unreadCount : undefined} />
                <SidebarNavItem href={`/${slug}/me/today`} icon="🎯" label="My Day" />
                <SidebarNavItem href={`/${slug}/board`} icon="🏃" label="Sprint board" badge={visibleProjects > 1 ? visibleProjects : undefined} badgeColor="rust" />
                <SidebarNavItem href={`/${slug}/backlog`} icon="🧹" label="Backlog" />
                <SidebarNavItem href={`/${slug}/issues`} icon="🐛" label="Table" />
                <SidebarNavItem href={`/${slug}/timeline`} icon="📅" label="Timeline" />
                <SidebarNavItem href={`/${slug}/calendar`} icon="🗓️" label="Calendar" />
                {opsLayer && <SidebarNavItem href={`/${slug}/time`} icon="⏱️" label="My Time" />}
              </div>
            </div>

            {/* Planning */}
            <div>
              <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--fw-text-dimmer)]">Planning</p>
              <div className="space-y-0.5">
                <SidebarNavItem href={`/${slug}/projects`} icon="📋" label="Projects" />
                <SidebarNavItem href={`/${slug}/roadmap`} icon="🗺️" label="Roadmap" />
                <SidebarNavItem href={`/${slug}/portfolio`} icon="📦" label="Portfolio" />
                <SidebarNavItem href={`/${slug}/mindmap`} icon="🧠" label="Mind Map" />
              </div>
            </div>

            {/* Insights */}
            <div>
              <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--fw-text-dimmer)]">Insights</p>
              <div className="space-y-0.5">
                <SidebarNavItem href={`/${slug}/reports`} icon="📊" label="Reports" />
                <SidebarNavItem href={`/${slug}/dashboards`} icon="🧩" label="Dashboards" />
              </div>
            </div>

            {/* Collaboration */}
            <div>
              <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--fw-text-dimmer)]">Collaboration</p>
              <div className="space-y-0.5">
                <SidebarNavItem href={`/${slug}/workload`} icon="👥" label="Team" />
                <SidebarNavItem href={`/${slug}/think-tank`} icon="💡" label="Think Tank" />
                <SidebarNavItem href={`/${slug}/whiteboards`} icon="🖊️" label="Whiteboards" />
              </div>
            </div>

            {/* Relationships */}
            <div>
              <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--fw-text-dimmer)]">Relationships</p>
              <div className="space-y-0.5">
                <SidebarNavItem href={`/${slug}/customers`} icon="🏢" label="Customers" />
                <SidebarNavItem href={`/${slug}/stakeholder`} icon="📈" label="Stakeholder" />
                <SidebarNavItem href={`/${slug}/changelog`} icon="📋" label="Changelog" />
              </div>
            </div>
          </>
        )}
      </nav>
    </>
  );
}
