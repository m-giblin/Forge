"use client";

import { useState, useTransition } from "react";
import { generateGuestLinkAction, revokeGuestLinkAction } from "./actions";
import TogglesList from "@/components/patterns/admin/TogglesList";
import AdminTable, { type AdminTableCell } from "@/components/patterns/admin/AdminTable";
import Note from "@/components/patterns/admin/Note";

type Project = { id: string; key: string; name: string };
type LinkState = { isActive: boolean; createdAt: string };

function relDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

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

  const activeProjects = projects.filter((p) => active[p.id]);
  const anyActive = activeProjects.length > 0;

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

  // No global "enable guest links" setting exists in the schema — the master toggle reflects
  // whether any link is currently active, and turning it off revokes every active link at once.
  function handleMasterToggle(_key: string, next: boolean) {
    if (readOnly) return;
    if (!next) {
      activeProjects.forEach((p) => revoke(p.id));
    }
  }

  const rows: AdminTableCell[][] = activeProjects.map((p) => {
    const link = linkMap[p.id];
    return [
      { kind: "bold", value: p.name },
      { kind: "dim", value: `Project · ${p.key}` },
      { kind: "dim", value: link ? relDate(link.createdAt) : "—" },
      { kind: "dim", value: "Never" },
      {
        kind: "link",
        value: pending ? "…" : "Revoke",
        onClick: readOnly ? undefined : () => revoke(p.id),
      },
    ];
  });

  return (
    <div className={`space-y-4 ${readOnly ? "pointer-events-none opacity-70" : ""}`}>
      {error && <Note icon="⚠" tone="error">{error}</Note>}

      <TogglesList
        items={[
          {
            key: "guest-links",
            label: "Enable guest links",
            description: "Allow admins to generate view-only links to a project's Board and Roadmap.",
            on: anyActive,
            tag: anyActive ? <span className="text-[11px] font-semibold text-[#726e60]">{activeProjects.length} active</span> : undefined,
          },
        ]}
        onChange={handleMasterToggle}
      />

      {/* Fresh URLs — shown once, right after generation, since the raw token is never stored */}
      {Object.entries(freshUrls).map(([projectId, url]) => {
        const p = projects.find((pr) => pr.id === projectId);
        if (!p) return null;
        return (
          <Note key={projectId} icon="🔗" tone="warning">
            <span className="font-semibold">{p.name}:</span> copy this link now — it won&apos;t be shown again.{" "}
            <button
              type="button"
              onClick={() => copy(projectId, url)}
              className="ml-1 font-semibold text-[#b7452f] hover:underline"
            >
              {copiedId === projectId ? "Copied!" : "Copy link"}
            </button>
            <input readOnly value={url} onFocus={(e) => e.target.select()} className="mt-1.5 block w-full rounded border border-[#f0dcb8] bg-white px-2 py-1 font-mono text-[11px] text-[#4a473e]" />
          </Note>
        );
      })}

      {projects.length === 0 ? (
        <p className="text-[12.5px] text-[#a19d90]">No active projects yet.</p>
      ) : activeProjects.length === 0 ? (
        <p className="text-[12.5px] text-[#a19d90]">No active guest links. Generate one below.</p>
      ) : (
        <AdminTable
          columns={[
            { label: "Label", flex: true },
            { label: "Scope", width: 190 },
            { label: "Created", width: 130 },
            { label: "Expires", width: 130 },
            { label: "", width: 90 },
          ]}
          rows={rows}
        />
      )}

      {!readOnly && (
        <div>
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Generate a new link</p>
          <div className="flex flex-wrap gap-2">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => generate(p.id)}
                disabled={pending}
                className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-1.5 text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#ede9db] disabled:opacity-50"
              >
                {active[p.id] ? `Regenerate — ${p.key}` : `Generate — ${p.key}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
