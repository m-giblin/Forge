"use client";

import { useState, useTransition } from "react";
import { setBlindVotingAction } from "./actions";

export default function BlindVotingToggle({ slug, enabled }: { slug: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    startTransition(async () => {
      try {
        await setBlindVotingAction(slug, next);
      } catch {
        setOn(!next); // revert on error
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50">
        <p className="text-sm font-semibold text-neutral-900">Voting Settings</p>
        <p className="text-xs text-neutral-500 mt-0.5">Control how idea voting works for your team.</p>
      </div>
      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-800">Blind voting mode</p>
            <p className="text-xs text-neutral-500 mt-0.5">
              When enabled, vote counts are hidden from members until you turn it off. Admins can still see counts.
              This removes social anchoring so early votes don&apos;t influence later ones.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={on}
            onClick={toggle}
            disabled={isPending}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${on ? "bg-amber-500" : "bg-neutral-200"}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${on ? "translate-x-5" : "translate-x-0"}`}
            />
          </button>
        </div>
        {on && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            <span>🔒</span>
            <span>Blind voting is <strong>active</strong>. Members see &ldquo;—&rdquo; instead of vote counts. Turn off to reveal results.</span>
          </div>
        )}
      </div>
    </div>
  );
}
