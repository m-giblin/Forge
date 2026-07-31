"use client";

import { useState, useTransition } from "react";
import { generateGuestLinkAction, revokeGuestLinkAction } from "./actions";

type Project = { id: string; key: string; name: string };
type LinkState = { isActive: boolean };

export default function GuestAccessManager({
  slug, readOnly, projects, linkMap,
}: {
  slug: string; readOnly: boolean; projects: Project[]; linkMap: Record<string, LinkState>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Freshly-generated URLs, kept only in memory — the raw token is never stored server-side, so this is the only place it's ever visible.
  const [freshUrls, setFreshUrls] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [active, setActive] = useState<Record<string, boolean>>(
    Object.fromEntries(projects.map((p) => [p.id, linkMap[p.id]?.isActive ?? false]))
  );

  function generate(projectId: string) {
    setError(null);
    startTransition(async () => {
      try {
        const url = await generateGuestLinkAction(slug, projectId);
        setFreshUrls((u) => ({ ...u, [projectId]: url }));
        setActive((a) => ({ ...a, [projectId]: true }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to generate link");
      }
    });
  }

  function revoke(projectId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await revokeGuestLinkAction(slug, projectId);
        setActive((a) => ({ ...a, [projectId]: false }));
        setFreshUrls((u) => { const n = { ...u }; delete n[projectId]; return n; });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to revoke link");
      }
    });
  }

  function copy(projectId: string, url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(projectId);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  return (
    <div className={`mt-6 space-y-3 ${readOnly ? "pointer-events-none opacity-70" : ""}`}>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {projects.length === 0 && <p className="text-sm text-neutral-400">No active projects yet.</p>}

      {projects.map((p) => {
        const isActive = active[p.id];
        const freshUrl = freshUrls[p.id];
        return (
          <div key={p.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs font-semibold text-neutral-600">{p.key}</span>
              <span className="font-medium text-neutral-900">{p.name}</span>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                {isActive ? "Link active" : "No active link"}
              </span>
            </div>

            {freshUrl && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-medium text-amber-800">Copy this now — for security it won&apos;t be shown again. Regenerate if you lose it.</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <input readOnly value={freshUrl} onFocus={(e) => e.target.select()} className="flex-1 rounded border border-amber-300 bg-white px-2 py-1 font-mono text-xs text-neutral-700" />
                  <button onClick={() => copy(p.id, freshUrl)} className="shrink-0 rounded-lg bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800">
                    {copiedId === p.id ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            )}

            {!readOnly && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => generate(p.id)}
                  disabled={pending}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                >
                  {isActive ? "Regenerate link" : "Generate link"}
                </button>
                {isActive && (
                  <button
                    onClick={() => revoke(p.id)}
                    disabled={pending}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
