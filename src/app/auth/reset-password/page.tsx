"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The recovery token arrives in the URL hash — only readable client-side.
    // Parse it and exchange for a session so updateUser() works.
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");

    if (type !== "recovery" || !accessToken || !refreshToken) {
      setTimeout(() => setError("Invalid or expired reset link. Please request a new one."), 0);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (error) {
        setError("This reset link has expired. Please request a new one.");
      } else {
        setReady(true);
      }
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Forge</h1>
          <p className="mt-1 text-sm text-neutral-500">Set a new password</p>
        </div>

        <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          {done ? (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              Password updated. Redirecting to login…
            </p>
          ) : error && !ready ? (
            <div>
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              <button
                onClick={() => router.push("/login")}
                className="mt-3 text-sm text-neutral-600 hover:underline"
              >
                ← Back to login
              </button>
            </div>
          ) : ready ? (
            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">New password</label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">Confirm password</label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
                  placeholder="Repeat password"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
              >
                {loading ? "Updating…" : "Set new password"}
              </button>
            </form>
          ) : (
            <p className="text-sm text-neutral-500">Verifying reset link…</p>
          )}
        </div>
      </div>
    </main>
  );
}
