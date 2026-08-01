"use client";

import { useState, useTransition } from "react";
import { setAiPrivacySettingsAction } from "./actions";
import TogglesList from "@/components/patterns/admin/TogglesList";

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
    <div>
      <h2 className="mb-2 text-[12.5px] font-bold text-[#20201d]">Privacy</h2>
      <p className="mb-2 text-[11px] text-[#726e60]">
        Controls how far issue/comment content travels to the AI provider, for privacy-sensitive workspaces.
      </p>
      <TogglesList
        items={[
          {
            key: "ai_disabled",
            label: "Disable all AI features",
            description: "Turns off every AI feature for this workspace — Sounding Board, triage, PR Impact, digests, all of it.",
            on: aiDisabled,
          },
          {
            key: "pii_scrub",
            label: "Scrub emails & phone numbers before sending to AI",
            description: "Best-effort redaction of the two most common PII patterns in outbound prompts. May reduce AI answer quality when that context was relevant.",
            on: piiScrub,
          },
        ]}
        onChange={(key, next) => {
          if (!isAdmin || saving) return;
          if (key === "ai_disabled") save(next, piiScrub);
          if (key === "pii_scrub") {
            if (aiDisabled) return;
            save(aiDisabled, next);
          }
        }}
      />
      {saved && <p className="mt-1.5 text-[11px] font-semibold text-[#4b7a4f]">Saved.</p>}
      {!isAdmin && <p className="mt-1.5 text-[11px] text-[#a19d90]">Only owners and admins can change these.</p>}
    </div>
  );
}
