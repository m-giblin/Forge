"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

const SHORTCUTS = [
  { keys: "j / k", desc: "Navigate issues up / down" },
  { keys: "Enter", desc: "Open selected issue" },
  { keys: "c", desc: "Create new issue" },
  { keys: "g b", desc: "Go to Board" },
  { keys: "g i", desc: "Go to Issues" },
  { keys: "g r", desc: "Go to Roadmap" },
  { keys: "g t", desc: "Go to Think Tank" },
  { keys: "g s", desc: "Go to Spaces" },
  { keys: "⌘K", desc: "Command palette" },
  { keys: "?", desc: "Show this help" },
  { keys: "Esc", desc: "Close modals / deselect" },
];

export default function GlobalKeys({ slug }: { slug: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [showHelp, setShowHelp] = useState(false);
  const [gPressed, setGPressed] = useState(false);
  const [gTimer, setGTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const clearG = useCallback(() => {
    setGPressed(false);
    if (gTimer) clearTimeout(gTimer);
  }, [gTimer]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement).isContentEditable;
      const meta = e.metaKey || e.ctrlKey;

      // Always handle Escape
      if (e.key === "Escape") { setShowHelp(false); clearG(); return; }
      // Skip if typing in an input / meta combos
      if (inInput || meta || e.altKey) return;

      // ? = help modal
      if (e.key === "?" && !e.shiftKey) { e.preventDefault(); setShowHelp((v) => !v); return; }

      // g-chord navigation
      if (e.key === "g" && !gPressed) {
        e.preventDefault();
        setGPressed(true);
        const t = setTimeout(() => setGPressed(false), 1200);
        setGTimer(t);
        return;
      }
      if (gPressed) {
        e.preventDefault();
        clearG();
        switch (e.key) {
          case "b": router.push(`/${slug}/board`); break;
          case "i": router.push(`/${slug}/issues`); break;
          case "r": router.push(`/${slug}/roadmap`); break;
          case "t": router.push(`/${slug}/think-tank`); break;
          case "s": router.push(`/${slug}/spaces`); break;
        }
        return;
      }

      // c = create issue (only when not on a detail page)
      if (e.key === "c" && !pathname.includes("/issues/") && !pathname.includes("/think-tank/")) {
        e.preventDefault();
        // Trigger the report bug / create button via CustomEvent
        document.dispatchEvent(new CustomEvent("forge:create-issue"));
        return;
      }

      // j / k = navigate focusable issue rows
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-issue-row]"));
        if (!rows.length) return;
        const focused = rows.findIndex((r) => r === document.activeElement || r.contains(document.activeElement));
        let next = e.key === "j" ? focused + 1 : focused - 1;
        if (next < 0) next = rows.length - 1;
        if (next >= rows.length) next = 0;
        rows[next]?.focus();
        rows[next]?.scrollIntoView({ block: "nearest" });
        return;
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [slug, router, pathname, gPressed, clearG]);

  if (!showHelp) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => setShowHelp(false)}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-neutral-100 px-5 py-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Keyboard shortcuts</h2>
          <button onClick={() => setShowHelp(false)} className="text-neutral-400 hover:text-neutral-600 text-lg leading-none">×</button>
        </div>
        <div className="px-5 py-4 space-y-1.5">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">{s.desc}</span>
              <span className="font-mono text-xs bg-neutral-100 text-neutral-700 rounded px-2 py-0.5 border border-neutral-200">{s.keys}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-neutral-100 px-5 py-3 text-xs text-neutral-400">
          Press <kbd className="font-mono bg-neutral-100 rounded px-1 border border-neutral-200">?</kbd> to toggle this panel
        </div>
      </div>
    </div>
  );
}
