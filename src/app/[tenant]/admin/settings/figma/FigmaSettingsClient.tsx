"use client";

import { useState, useTransition } from "react";
import { saveFigmaConfigAction } from "./actions";
import type { FigmaConfig } from "@/lib/services/figmaIntegration";

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
    <div>
      <h1 className="text-xl font-bold text-neutral-900">Figma</h1>
      <p className="mt-0.5 text-sm text-neutral-500">
        Connect your team&apos;s Figma workspace so designers and engineers share one link. Linking specific design
        files to issues isn&apos;t built yet — this just turns the connection on and points at your team.
      </p>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-neutral-900">Connect Figma</p>
            <p className="text-xs text-neutral-500">Show a Figma link in the gear menu.</p>
          </div>
          <button
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((e) => !e)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? "bg-neutral-900" : "bg-neutral-200"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">Figma team URL</label>
          <input
            type="url"
            value={teamUrl}
            onChange={(e) => setTeamUrl(e.target.value)}
            placeholder="https://www.figma.com/files/team/..."
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
          />
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {saved && !error && <p className="mt-3 text-sm text-emerald-700">Saved.</p>}

        <div className="mt-4">
          <button
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
