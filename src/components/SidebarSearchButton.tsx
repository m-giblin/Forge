"use client";

export default function SidebarSearchButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("forge:palette:open"))}
      className="flex w-full items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-left text-xs text-neutral-500 hover:border-neutral-300 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
    >
      <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8" strokeWidth="2" />
        <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="flex-1">Search…</span>
      <kbd className="rounded bg-neutral-200 px-1 py-0.5 text-[10px] font-mono text-neutral-400">⌘K</kbd>
    </button>
  );
}
