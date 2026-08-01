"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Wraps the primary workspace sidebar and collapses it to zero width when
 * inside a section that has its own full-height sub-nav (currently: Reports)
 * — that section's sub-nav has its own "Back to workspace" link to exit and
 * re-expand this one. Avoids two full-height navs competing for space.
 */
export default function CollapsibleSidebarShell({ slug, children }: { slug: string; children: ReactNode }) {
  const pathname = usePathname();
  const collapsed = pathname?.startsWith(`/${slug}/reports`) ?? false;

  return (
    <div
      className="hidden md:block shrink-0 transition-[width] duration-200 ease-out"
      style={{ width: collapsed ? 0 : 224, overflow: collapsed ? "hidden" : "visible" }}
    >
      <div className="w-56">{children}</div>
    </div>
  );
}
