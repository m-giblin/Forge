"use client";

import { useState, useTransition } from "react";
import { signOffAction, revokeSignOffAction } from "../actions";
import { SIGNOFF_ROLES, type IdeaSignoff, type SignoffRole } from "@/lib/repositories/ideas";

const ROLE_META: Record<SignoffRole, { label: string; icon: string }> = {
  design: { label: "Design", icon: "🎨" },
  product: { label: "Product", icon: "📊" },
  engineering: { label: "Engineering", icon: "⚙️" },
};

interface Props {
  slug: string;
  ideaId: string;
  signoffs: IdeaSignoff[];
  canSign: boolean;
}

// Design C — cross-functional readiness. Each role (Design / Product /
// Engineering) is approved or pending; any member can approve or undo. Soft
// gate: this never blocks convert, it just makes alignment visible.
export default function IdeaSignoffs({ slug, ideaId, signoffs, canSign }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const byRole = new Map(signoffs.map((s) => [s.role, s]));

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-off update failed.");
      }
    });
  }

  return (
    <section className="mb-6 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-800">Sign-offs</h3>
        <span className="text-xs text-neutral-400">
          {signoffs.length} of {SIGNOFF_ROLES.length} approved
        </span>
      </div>
      <p className="mb-3 text-xs text-neutral-400">
        Cross-functional readiness. Approvals are advisory — they don&apos;t block converting.
      </p>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SIGNOFF_ROLES.map((role) => {
          const s = byRole.get(role);
          const m = ROLE_META[role];
          const done = !!s;
          return (
            <div
              key={role}
              className={`rounded-lg border p-3 ${done ? "border-green-200 bg-green-50" : "border-neutral-200 bg-neutral-50"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-800">
                  {m.icon} {m.label}
                </span>
                {done ? (
                  <span className="text-xs font-semibold text-green-700">✓ Approved</span>
                ) : (
                  <span className="text-xs text-neutral-400">Pending</span>
                )}
              </div>
              {done && s?.approvedByName && (
                <p className="mt-1 text-xs text-neutral-500">
                  {s.approvedByName} · {new Date(s.createdAt).toLocaleDateString()}
                </p>
              )}
              {canSign && (
                <button
                  onClick={() => run(() => (done ? revokeSignOffAction(slug, ideaId, role) : signOffAction(slug, ideaId, role, "")))}
                  disabled={isPending}
                  className={`mt-2 w-full rounded-md px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${
                    done
                      ? "border border-neutral-200 text-neutral-500 hover:bg-white"
                      : "bg-neutral-900 text-white hover:bg-neutral-800"
                  }`}
                >
                  {done ? "Undo" : "Approve"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
