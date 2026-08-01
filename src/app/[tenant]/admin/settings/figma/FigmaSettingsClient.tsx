"use client";

import { useState, useTransition } from "react";
import { saveFigmaConfigAction } from "./actions";
import type { FigmaConfig } from "@/lib/services/figmaIntegration";
import PageHeader from "@/components/patterns/PageHeader";
import ConnectCards from "@/components/patterns/admin/ConnectCards";
import FormGrid from "@/components/patterns/admin/FormGrid";
import Note from "@/components/patterns/admin/Note";

const inputCls =
  "w-full rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[12.5px] text-[#20201d] placeholder-[#a19d90] outline-none focus:border-[#b7452f]";

export default function FigmaSettingsClient({ slug, config }: { slug: string; config: FigmaConfig }) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [teamUrl, setTeamUrl] = useState(config.teamUrl);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await saveFigmaConfigAction(slug, { enabled, teamUrl });
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Figma" subtitle="Attach design files to issues" />

      <div className="space-y-6 px-6">
        <ConnectCards
          items={[
            {
              key: "figma",
              name: "Figma",
              icon: "🎨",
              description: enabled
                ? "Connected. A Figma link is shown in the gear menu."
                : "Show a Figma link in the gear menu for this workspace.",
              connected: enabled,
              onAction: () => setEnabled((e) => !e),
            },
          ]}
        />

        {error && <Note icon="⚠" tone="error">{error}</Note>}
        {saved && !error && <Note icon="✓" tone="info">Saved.</Note>}

        <div>
          <h2 className="mb-3 text-[12.5px] font-bold text-[#20201d]">Configuration</h2>
          <FormGrid
            fields={[
              {
                key: "teamUrl",
                label: "Figma team URL",
                input: (
                  <input
                    type="url"
                    value={teamUrl}
                    onChange={(e) => setTeamUrl(e.target.value)}
                    placeholder="https://www.figma.com/files/team/..."
                    className={inputCls}
                  />
                ),
              },
            ]}
            onSubmit={save}
            submitLabel={pending ? "Saving…" : "Save"}
          />
        </div>

        <p className="text-[11px] text-[#a19d90]">
          Linking specific design files to individual issues isn&apos;t built yet — this just turns the connection
          on and points at your team.
        </p>
      </div>
    </div>
  );
}
