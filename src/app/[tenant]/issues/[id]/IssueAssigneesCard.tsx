"use client";

import { useState, useTransition } from "react";

type Member = { userId: string; label: string };

function initials(label: string): string {
  return label
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("") || "?";
}

function avatarColor(label: string): string {
  const colors = [
    "bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500",
    "bg-teal-500", "bg-sky-500", "bg-indigo-500", "bg-violet-500", "bg-fuchsia-500",
  ];
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return colors[h % colors.length]!;
}

/**
 * Full assignee-set editor. issues.assignee_id is the PRIMARY; this card manages
 * the complete set via /api/issues/[id]/assignees and reflects primary changes
 * the server makes (promote-on-remove, auto-primary-on-first-add).
 */
export default function IssueAssigneesCard({
  slug,
  issueId,
  members,
  primaryId,
  initialAssigneeIds,
  readOnly,
}: {
  slug: string;
  issueId: string;
  members: Member[];
  primaryId: string | null;
  initialAssigneeIds: string[];
  readOnly: boolean;
}) {
  const [assignees, setAssignees] = useState<string[]>(initialAssigneeIds);
  const [primary, setPrimary] = useState<string | null>(primaryId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const labelFor = (uid: string) => members.find((m) => m.userId === uid)?.label ?? "Unknown";
  const available = members.filter((m) => !assignees.includes(m.userId));

  async function mutate(method: "POST" | "DELETE", userId: string) {
    setError(null);
    const res = await fetch(`/api/issues/${issueId}/assignees?slug=${encodeURIComponent(slug)}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Couldn't update assignees. Try again.");
      return;
    }
    const body = (await res.json()) as { assignees: { userId: string }[] };
    const ids = body.assignees.map((a) => a.userId);
    setAssignees(ids);
    // Server keeps primary in sync; reflect its decision locally.
    if (!ids.includes(primary ?? "")) setPrimary(ids[0] ?? null);
  }

  const add = (userId: string) => startTransition(() => void mutate("POST", userId));
  const remove = (userId: string) => startTransition(() => void mutate("DELETE", userId));

  return (
    <div>
      <p className="text-xs font-medium text-neutral-500 mb-1">
        Assignees ({assignees.length})
      </p>

      {assignees.length === 0 ? (
        <p className="text-xs text-neutral-400 mb-2">No one assigned yet</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {assignees.map((uid) => {
            const label = labelFor(uid);
            const isPrimary = uid === primary;
            return (
              <span
                key={uid}
                title={isPrimary ? `${label} · primary` : label}
                className={`inline-flex items-center gap-1 rounded-full pl-1 pr-2 py-0.5 text-xs border ${
                  isPrimary ? "border-blue-300 bg-blue-100 text-blue-800" : "border-neutral-200 bg-white text-neutral-700"
                }`}
              >
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-semibold text-white ${avatarColor(label)}`}>
                  {initials(label)}
                </span>
                <span className="max-w-[9rem] truncate">{label}</span>
                {isPrimary && <span className="text-[9px] uppercase tracking-wide font-semibold text-blue-500">Primary</span>}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => remove(uid)}
                    disabled={pending}
                    aria-label={`Remove ${label}`}
                    className="ml-0.5 text-neutral-400 hover:text-rose-600 disabled:opacity-40"
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {!readOnly && available.length > 0 && (
        <select
          value=""
          disabled={pending}
          onChange={(e) => { if (e.target.value) add(e.target.value); }}
          className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 disabled:opacity-50"
        >
          <option value="">+ Add assignee…</option>
          {available.map((m) => (
            <option key={m.userId} value={m.userId}>{m.label}</option>
          ))}
        </select>
      )}

      {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
    </div>
  );
}
