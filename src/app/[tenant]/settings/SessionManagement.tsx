"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

function fmt(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium", timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function SessionManagement({ lastSignIn }: { lastSignIn: string | null }) {
  const [status, setStatus] = useState<"idle" | "revoking" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function revokeOtherSessions() {
    setStatus("revoking");
    setError(null);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      // "others" scope invalidates all sessions except the current one
      const { error: err } = await supabase.auth.signOut({ scope: "others" });
      if (err) throw err;
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke sessions");
      setStatus("error");
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="font-medium text-neutral-900 text-sm">Current session</p>
            {lastSignIn && (
              <p className="mt-1 text-xs text-neutral-500">
                Signed in: <span className="text-neutral-700">{fmt(lastSignIn)}</span>
              </p>
            )}
            <p className="mt-1 text-xs text-neutral-400">
              This device is currently authenticated. Other sessions on different devices
              can be revoked below.
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            ● Active
          </span>
        </div>

        <div className="border-t border-neutral-100 pt-4">
          <p className="text-sm font-medium text-neutral-900 mb-1">Sign out other devices</p>
          <p className="text-xs text-neutral-500 mb-3">
            Invalidates all other active sessions. You will remain signed in on this device.
          </p>

          {status === "done" ? (
            <p className="text-sm text-emerald-600 font-medium">✓ All other sessions have been revoked.</p>
          ) : (
            <button
              onClick={revokeOtherSessions}
              disabled={status === "revoking"}
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 transition"
            >
              {status === "revoking" ? "Revoking…" : "Sign out all other devices"}
            </button>
          )}

          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
