"use client";

import { useEffect, useRef, useState } from "react";

interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export function DocToc({ headings }: { headings: TocItem[] }) {
  const [active, setActive] = useState<string>("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;
    observerRef.current?.disconnect();

    const els = headings.map((h) => document.getElementById(h.id)).filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );
    els.forEach((el) => observerRef.current!.observe(el));
    return () => observerRef.current?.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <nav className="space-y-0.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-3 px-1">On this page</p>
      {headings.map((h) => (
        <a
          key={h.id}
          href={`#${h.id}`}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            setActive(h.id);
          }}
          className={`block text-[13px] leading-snug py-1 transition-colors rounded ${h.level === 3 ? "pl-4" : "pl-1"} ${
            active === h.id ? "text-indigo-600 font-medium" : "text-neutral-400 hover:text-neutral-700"
          }`}
        >
          {h.text}
        </a>
      ))}
    </nav>
  );
}
