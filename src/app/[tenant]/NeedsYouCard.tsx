"use client";

import Link from "next/link";
import { useState, useTransition, useRef, useEffect } from "react";
import { quickAssignAction } from "./actions";

type Member = { userId: string; label: string };
type Attention = {
  issueId: string;
  tag: string;
  ref: string;
  title: string;
  meta: string;
  urgent: boolean;
};

const TAG_STYLE: Record<string, { label: string; cls: string }> = {
  BLOCKED:    { label: "BLOCKED",    cls: "bg-red-100 text-red-700" },
  UNASSIGNED: { label: "UNASSIGNED", cls: "bg-orange-100 text-orange-700" },
  IN_REVIEW:  { label: "IN REVIEW",  cls: "bg-purple-100 text-purple-700" },
  STALE:      { label: "STALE",      cls: "bg-amber-100 text-amber-700" },
  ASSIGNED:   { label: "ASSIGNED",   cls: "bg-sky-100 text-sky-700" },
};

function AssignButton({ slug, issueId, members, onAssigned }: {
  slug: string;
  issueId: string;
  members: Member[];
  onAssigned: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  function assign(userId: string) {
    setOpen(false);
    startTransition(async () => {
      await quickAssignAction(slug, issueId, userId);
      onAssigned();
    });
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        disabled={isPending}
        className="rounded-md border border-orange-300 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700 hover:bg-orange-100 transition disabled:opacity-50"
      >
        {isPending ? "…" : "Assign →"}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-lg border border-neutral-200 bg-white shadow-lg py-1">
          {members.map((m) => (
            <button
              key={m.userId}
              onClick={(e) => { e.preventDefault(); assign(m.userId); }}
              className="w-full px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50"
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NeedsYouCards({ slug, items, members }: {
  slug: string;
  items: Attention[];
  members: Member[];
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = items.filter((a) => !dismissed.has(a.issueId));

  return (
    <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
      {visible.map((a) => {
        const t = TAG_STYLE[a.tag] ?? { label: a.tag, cls: "bg-neutral-100 text-neutral-700" };
        return (
          <div key={a.issueId} className="block p-2.5 rounded-lg border border-neutral-200 bg-white hover:shadow-sm hover:border-neutral-300 transition">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.cls}`}>{t.label}</span>
              <span className="text-[11px] font-mono text-neutral-400">{a.ref}</span>
              {a.tag === "UNASSIGNED" && (
                <div className="ml-auto">
                  <AssignButton
                    slug={slug}
                    issueId={a.issueId}
                    members={members}
                    onAssigned={() => setDismissed((d) => new Set([...d, a.issueId]))}
                  />
                </div>
              )}
            </div>
            <Link href={`/${slug}/issues/${a.issueId}`} className="block mt-1.5">
              <p className="text-sm font-medium text-neutral-900 leading-snug hover:text-indigo-600">{a.title}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{a.meta}</p>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
