"use client";

import Link from "next/link";

/**
 * Persistent chrome above every workspace page — global search (opens the
 * existing CommandPalette), a report-export shortcut, and quick issue create.
 * Matches HANDOFF §2 top-bar spec; shared so no page hand-rolls its own.
 */
export default function WorkspaceTopBar({ slug }: { slug: string }) {
  return (
    <div
      className="fw-grunge hidden md:flex h-[58px] shrink-0 items-center gap-3.5 px-[22px]"
      style={{
        background: "linear-gradient(170deg,#2b2924 0%,#211f1a 100%)",
        borderBottom: "1px solid #100f0d",
      }}
    >
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("forge:palette:open"))}
        className="relative flex-1 max-w-[420px] text-left"
      >
        <svg
          width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#736e5c" strokeWidth="2.3"
          className="pointer-events-none absolute left-[11px] top-1/2 -translate-y-1/2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <span className="block w-full truncate rounded-[5px] border border-[#3a382f] bg-[#181a16] py-2 pl-[33px] pr-3 text-[13px] text-[#736e5c]">
          Search issues, projects, people…
        </span>
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <Link
          href={`/${slug}/reports`}
          className="flex items-center gap-1.5 rounded-[5px] border border-[#3a382f] bg-[#181a16] px-[11px] py-1.5 text-[11.5px] font-semibold text-[#a39d89] hover:text-[#e5e0d1] transition"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Export report
        </Link>
        <Link
          href={`/${slug}/board?new=1`}
          data-ember-tour="board-new-issue"
          className="flex items-center gap-1.5 rounded-[5px] border border-[var(--fw-rust-border)] px-[13px] py-[7px] text-[12px] font-bold text-[#f2e9d8] transition"
          style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New issue
        </Link>
      </div>
    </div>
  );
}
