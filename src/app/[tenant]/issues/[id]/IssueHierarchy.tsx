"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { IssueLinkWithKey } from "@/lib/repositories/issueLinks";
import {
  addIssueLinkAction,
  removeIssueLinkAction,
  createSubIssueAction,
} from "./issueHierarchyActions";

const LINK_TYPE_META = {
  blocks:      { label: "Blocks", inverse: "is blocked by" },
  relates_to:  { label: "Relates to", inverse: "Relates to" },
  duplicates:  { label: "Duplicates", inverse: "is duplicated by" },
};

const STATUS_DOT: Record<string, string> = {
  done: "bg-emerald-500",
  in_review: "bg-blue-400",
  in_progress: "bg-amber-400",
};

function statusDot(status: string) {
  return STATUS_DOT[status] ?? "bg-neutral-300";
}

export function SubIssuesCard({
  slug,
  parentIssueId,
  projectId,
  projectKey,
  subIssues,
  readOnly,
}: {
  slug: string;
  parentIssueId: string;
  projectId: string;
  projectKey: string;
  subIssues: { id: string; number: number; title: string; status: string; priority: string }[];
  readOnly: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const done = subIssues.filter((i) => i.status === "done").length;

  function submit() {
    if (!title.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createSubIssueAction(slug, parentIssueId, projectId, title);
        setTitle("");
        setAdding(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Sub-issues {subIssues.length > 0 && <span className="font-normal">({done}/{subIssues.length})</span>}
        </p>
        {!readOnly && (
          <button onClick={() => setAdding((s) => !s)} className="text-xs text-neutral-400 hover:text-neutral-700">
            {adding ? "Cancel" : "+ Add"}
          </button>
        )}
      </div>

      {subIssues.length > 0 && (
        <ul className="space-y-1 mb-2">
          {subIssues.map((i) => (
            <li key={i.id} className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(i.status)}`} />
              <Link
                href={`/${slug}/issues/${i.id}`}
                className="text-xs text-neutral-700 hover:text-neutral-900 truncate flex-1"
              >
                <span className="font-mono text-neutral-400 mr-1">{projectKey}-{i.number}</span>
                {i.title}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {subIssues.length === 0 && !adding && (
        <p className="text-xs text-neutral-400">No sub-issues yet.</p>
      )}

      {adding && (
        <div className="mt-2 space-y-1.5">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setAdding(false); }}
            placeholder="Sub-issue title…"
            disabled={pending}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-1.5">
            <button onClick={submit} disabled={pending || !title.trim()}
              className="rounded-lg bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50 hover:bg-neutral-700">
              {pending ? "Adding…" : "Add"}
            </button>
            <button onClick={() => setAdding(false)} className="rounded-lg border border-neutral-200 px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function LinkedIssuesCard({
  slug,
  issueId,
  links,
  readOnly,
}: {
  slug: string;
  issueId: string;
  links: IssueLinkWithKey[];
  readOnly: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [linkType, setLinkType] = useState<"blocks" | "relates_to" | "duplicates">("relates_to");
  const [targetKey, setTargetKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addLink() {
    const num = parseInt(targetKey.split("-").pop() ?? "", 10);
    if (!num) { setError("Enter a valid issue key (e.g. WEB-12)"); return; }
    setError(null);
    // We need the target issue ID — look it up via the key number
    startTransition(async () => {
      try {
        // The UI passes the full key like "WEB-12"; we need the UUID.
        // We'll pass the key as-is and let the action resolve it — but our action takes UUIDs.
        // For now show an error explaining this limitation.
        setError("Enter the issue ID (UUID) — key lookup coming soon. Copy from the issue URL.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function removeLink(linkId: string) {
    startTransition(() => removeIssueLinkAction(slug, linkId, issueId));
  }

  function addLinkById(targetId: string) {
    if (!targetId.trim()) { setError("Enter an issue ID."); return; }
    setError(null);
    startTransition(async () => {
      try {
        await addIssueLinkAction(slug, issueId, targetId.trim(), linkType);
        setTargetKey("");
        setAdding(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Linked issues {links.length > 0 && `(${links.length})`}
        </p>
        {!readOnly && (
          <button onClick={() => setAdding((s) => !s)} className="text-xs text-neutral-400 hover:text-neutral-700">
            {adding ? "Cancel" : "+ Add"}
          </button>
        )}
      </div>

      {links.length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {links.map((l) => {
            const meta = LINK_TYPE_META[l.linkType];
            const label = l.direction === "outbound" ? meta.label : meta.inverse;
            return (
              <li key={l.id} className="flex items-center gap-2 group">
                <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(l.targetStatus)}`} />
                <span className="text-[11px] text-neutral-400 shrink-0">{label}</span>
                <Link
                  href={`/${slug}/issues/${l.direction === "outbound" ? l.targetIssueId : l.sourceIssueId}`}
                  className="text-xs text-neutral-700 hover:text-neutral-900 truncate flex-1"
                >
                  <span className="font-mono text-neutral-400 mr-1">{l.targetKey}</span>
                  {l.targetTitle}
                </Link>
                {!readOnly && (
                  <button
                    onClick={() => removeLink(l.id)}
                    disabled={pending}
                    className="hidden group-hover:block text-neutral-300 hover:text-red-500 text-xs"
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {links.length === 0 && !adding && (
        <p className="text-xs text-neutral-400">No linked issues.</p>
      )}

      {adding && (
        <div className="mt-2 space-y-1.5">
          <select
            value={linkType}
            onChange={(e) => setLinkType(e.target.value as typeof linkType)}
            className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900"
          >
            <option value="blocks">Blocks</option>
            <option value="relates_to">Relates to</option>
            <option value="duplicates">Duplicates</option>
          </select>
          <input
            autoFocus
            value={targetKey}
            onChange={(e) => setTargetKey(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addLinkById(targetKey); if (e.key === "Escape") setAdding(false); }}
            placeholder="Target issue ID (UUID from URL)"
            disabled={pending}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 font-mono"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-1.5">
            <button onClick={() => addLinkById(targetKey)} disabled={pending || !targetKey.trim()}
              className="rounded-lg bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50 hover:bg-neutral-700">
              {pending ? "Linking…" : "Link"}
            </button>
            <button onClick={() => setAdding(false)} className="rounded-lg border border-neutral-200 px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
