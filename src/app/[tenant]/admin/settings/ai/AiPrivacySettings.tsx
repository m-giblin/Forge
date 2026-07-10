"use client";

import { useState, useTransition } from "react";
import { setAiPrivacySettingsAction } from "./actions";

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors focus:outline-none disabled:opacity-40 ${checked ? "bg-indigo-600" : "bg-neutral-200"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

export default function AiPrivacySettings({
  slug,
  initialAiDisabled,
  initialPiiScrub,
  isAdmin,
}: {
  slug: string;
  initialAiDisabled: boolean;
  initialPiiScrub: boolean;
  isAdmin: boolean;
}) {
  const [aiDisabled, setAiDisabled] = useState(initialAiDisabled);
  const [piiScrub, setPiiScrub] = useState(initialPiiScrub);
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);

  function save(nextAiDisabled: boolean, nextPiiScrub: boolean) {
    setAiDisabled(nextAiDisabled);
    setPiiScrub(nextPiiScrub);
    setSaved(false);
    startSave(async () => {
      await setAiPrivacySettingsAction(slug, nextAiDisabled, nextPiiScrub);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50">
        <p className="text-sm font-semibold text-neutral-800">Privacy</p>
        <p className="text-xs text-neutral-500 mt-0.5">Controls how far issue/comment content travels to xAI, for privacy-sensitive workspaces.</p>
      </div>
      <div className="px-5">
        <div className="flex items-center justify-between gap-6 py-4 border-b border-neutral-100">
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-900">Disable all AI features</p>
            <p className="text-xs text-neutral-500 mt-0.5">Turns off every AI feature for this workspace — Sounding Board, triage, PR Impact, digests, all of it.</p>
          </div>
          <Toggle checked={aiDisabled} onChange={(v) => save(v, piiScrub)} disabled={!isAdmin || saving} />
        </div>
        <div className="flex items-center justify-between gap-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-900">Scrub emails &amp; phone numbers before sending to AI</p>
            <p className="text-xs text-neutral-500 mt-0.5">Best-effort redaction of the two most common PII patterns in outbound prompts. May reduce AI answer quality when that context was relevant.</p>
          </div>
          <Toggle checked={piiScrub} onChange={(v) => save(aiDisabled, v)} disabled={!isAdmin || aiDisabled || saving} />
        </div>
      </div>
      {saved && <p className="px-5 pb-3 text-xs text-green-600">Saved.</p>}
      {!isAdmin && <p className="px-5 pb-3 text-xs text-neutral-400">Only owners and admins can change these.</p>}
    </div>
  );
}
