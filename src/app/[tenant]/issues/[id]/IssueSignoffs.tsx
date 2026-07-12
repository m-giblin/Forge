"use client";

import { useState, useTransition } from "react";
import { addSignoffRoleAction, signIssueAction, unsignIssueAction, removeSignoffRoleAction } from "./signoffActions";

export type IssueSignoff = {
  id: string;
  role_label: string;
  signed_by: string | null;
  signed_at: string | null;
  signer_label?: string | null;
};

export function IssueSignoffsPanel({
  slug,
  issueId,
  signoffs,
  readOnly,
  userRole,
  currentUserId,
  hideLabel,
}: {
  slug: string;
  issueId: string;
  signoffs: IssueSignoff[];
  readOnly: boolean;
  userRole: string;
  currentUserId: string;
  /** Suppress the "Sign-offs" label — used when an outer collapsible section already shows it. */
  hideLabel?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isAdmin = userRole === "owner" || userRole === "admin";
  const allSigned = signoffs.length > 0 && signoffs.every((s) => s.signed_by);
  const unsingedCount = signoffs.filter((s) => !s.signed_by).length;

  function addRole() {
    const label = newRole.trim();
    if (!label) return;
    setError(null);
    startTransition(async () => {
      try {
        await addSignoffRoleAction(slug, issueId, label);
        setNewRole("");
        setAdding(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function sign(signoffId: string) {
    startTransition(() => signIssueAction(slug, signoffId, issueId));
  }

  function unsign(signoffId: string) {
    startTransition(() => unsignIssueAction(slug, signoffId, issueId));
  }

  function remove(signoffId: string) {
    startTransition(() => removeSignoffRoleAction(slug, signoffId, issueId));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 flex items-center gap-2">
          {!hideLabel && "Sign-offs"}
          {signoffs.length > 0 && (
            <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold border ${
              allSigned
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}>
              {allSigned ? "✓ All approved" : `${unsingedCount} pending`}
            </span>
          )}
        </p>
        {isAdmin && !readOnly && (
          <button
            onClick={() => setAdding((s) => !s)}
            className="text-xs text-neutral-400 hover:text-neutral-700"
          >
            {adding ? "Cancel" : "+ Add role"}
          </button>
        )}
      </div>

      {signoffs.length === 0 && !adding && (
        <p className="text-xs text-neutral-400 italic">
          No sign-offs required.{isAdmin && !readOnly && " Add required approver roles above."}
        </p>
      )}

      {signoffs.length > 0 && (
        <ul className="space-y-2">
          {signoffs.map((s) => {
            const isSigned = !!s.signed_by;
            const isMySign = s.signed_by === currentUserId;
            return (
              <li key={s.id} className="flex items-center gap-3 group">
                <div className={`h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                  isSigned ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-400"
                }`}>
                  {isSigned ? "✓" : "○"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-neutral-700">{s.role_label}</p>
                  {isSigned && (
                    <p className="text-[10px] text-neutral-400">
                      {s.signer_label ?? "Signed"}{s.signed_at ? ` · ${new Date(s.signed_at).toLocaleDateString()}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!readOnly && !isSigned && (
                    <button
                      onClick={() => sign(s.id)}
                      disabled={pending}
                      className="rounded px-2 py-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                    >
                      Approve
                    </button>
                  )}
                  {!readOnly && isSigned && isMySign && (
                    <button
                      onClick={() => unsign(s.id)}
                      disabled={pending}
                      className="rounded px-2 py-1 text-[11px] font-medium bg-neutral-50 text-neutral-500 hover:bg-neutral-100 border border-neutral-200"
                    >
                      Revoke
                    </button>
                  )}
                  {isAdmin && !readOnly && (
                    <button
                      onClick={() => remove(s.id)}
                      disabled={pending}
                      className="text-neutral-300 hover:text-red-500 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {adding && isAdmin && (
        <div className="flex gap-2 pt-1">
          <input
            autoFocus
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addRole(); if (e.key === "Escape") setAdding(false); }}
            placeholder="e.g. Design, Engineering, Product"
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
          />
          <button
            onClick={addRole}
            disabled={pending || !newRole.trim()}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
