"use client";

import { useState, useTransition } from "react";
import { setBlindVotingAction } from "./actions";
import Toggle from "@/components/patterns/Toggle";
import Note from "@/components/patterns/admin/Note";

export default function BlindVotingToggle({ slug, enabled }: { slug: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [isPending, startTransition] = useTransition();

  function toggle(next: boolean) {
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
    <div>
      <p className="mb-1.5 px-0.5 text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">Voting Settings</p>
      <div className="fw-card overflow-hidden">
        <div className="flex items-center gap-3 px-3.5 py-[11px]">
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold text-[#20201d]">Blind voting mode</p>
            <p className="mt-0.5 text-[11px] text-[#726e60]">
              When enabled, vote counts are hidden from members until you turn it off. Admins can still see counts. This removes social anchoring so early votes don&apos;t influence later ones.
            </p>
          </div>
          <Toggle on={on} onChange={toggle} label="Blind voting mode" />
        </div>
        {on && (
          <div className="border-t border-[#e3ded0] px-3.5 py-3">
            <Note icon="🔒" tone="warning">
              Blind voting is <strong>active</strong>. Members see &ldquo;—&rdquo; instead of vote counts. Turn off to reveal results.
            </Note>
          </div>
        )}
      </div>
      {isPending && <p className="mt-1 text-[11px] text-[#a19d90]">Saving…</p>}
    </div>
  );
}
