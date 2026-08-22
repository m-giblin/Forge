"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Project = { id: string; key: string; name: string };

type Props = {
  slug: string;
  projects: Project[];
  current: Project | null; // null = "All Projects"
};

// Sticky project selector (upper-left, under the tenant switcher) — FORGE-188.
// Persists the choice server-side (per-user cookie) so Board/Issues stay
// scoped to it across navigation until changed.
export default function ProjectSwitcher({ slug, projects, current }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function select(projectId: string) {
    setOpen(false);
    await fetch("/api/current-project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, projectId }),
    });
    startTransition(() => router.refresh());
  }

  if (projects.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Switch project"
        disabled={pending}
        className="flex w-full items-center gap-2 px-2.5 py-[7px] text-left transition-colors hover:bg-white/[0.06] disabled:opacity-60"
      >
        <span className="text-[13px] leading-none">📁</span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[var(--fw-text-bright)]">
          {current ? current.name : "All Projects"}
        </span>
        <span className="shrink-0 text-[10px] text-[var(--fw-text-bright)]">▾</span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[200px] rounded-lg border border-[#565a49] bg-[#262920] py-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.6)]"
        >
          <div className="max-h-[60vh] overflow-y-auto px-1.5">
            <button
              onClick={() => select("all")}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                current === null
                  ? "bg-[var(--fw-rust)]/25 text-[var(--fw-text-bright)]"
                  : "text-[var(--fw-text-dim)] hover:bg-white/[0.08] hover:text-[var(--fw-text-bright)]"
              }`}
            >
              <span className="w-4 shrink-0 text-center">📂</span>
              <span className="flex-1 truncate">All Projects</span>
            </button>
            <div className="my-1 h-px bg-[#4a4d3f]" />
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => select(p.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                  current?.id === p.id
                    ? "bg-[var(--fw-rust)]/25 text-[var(--fw-text-bright)]"
                    : "text-[var(--fw-text-dim)] hover:bg-white/[0.08] hover:text-[var(--fw-text-bright)]"
                }`}
              >
                <span className="w-4 shrink-0 text-center text-[10px] font-bold opacity-70">{p.key.slice(0, 2)}</span>
                <span className="flex-1 truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
