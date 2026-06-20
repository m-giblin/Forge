"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function SecuritySettingsPage() {
  const { tenant: slug } = useParams<{ tenant: string }>();
  const [requireMfa, setRequireMfa] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/security?tenant=${slug}`)
      .then((r) => r.json())
      .then((d) => { setRequireMfa(d.requireMfa ?? false); setLoaded(true); });
  }, [slug]);

  async function save(next: boolean) {
    setSaving(true);
    setSaved(false);
    setError(null);
    const res = await fetch("/api/admin/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, requireMfa: next }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Save failed.");
      return;
    }
    setRequireMfa(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (!loaded) return <div className="text-sm text-neutral-400">Loading…</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Security</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Enforce security policies for everyone in this workspace.
        </p>
      </div>

      {/* MFA enforcement card */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="p-5 flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-neutral-900">Require two-factor authentication</p>
              {requireMfa ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  Enforced
                </span>
              ) : (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">
                  Off
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-neutral-500">
              When enabled, every member — including admins and the owner — must enroll a TOTP
              authenticator app and pass a code challenge on every login. Users who have not
              enrolled are blocked from the workspace until they do.
            </p>
            {requireMfa && (
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠ MFA is currently enforced. All members without an enrolled authenticator will
                be blocked at their next login until they enroll.
              </p>
            )}
          </div>
          <button
            onClick={() => save(!requireMfa)}
            disabled={saving}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
              requireMfa
                ? "border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                : "bg-neutral-900 text-white hover:bg-neutral-800"
            }`}
          >
            {saving ? "Saving…" : requireMfa ? "Disable" : "Enable"}
          </button>
        </div>
        {saved && (
          <div className="border-t border-emerald-100 bg-emerald-50 px-5 py-2.5 text-sm text-emerald-700">
            ✓ Saved — changes take effect on the next login for each member.
          </div>
        )}
        {error && (
          <div className="border-t border-red-100 bg-red-50 px-5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Future security settings placeholder */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 opacity-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-neutral-900">Session timeout</p>
            <p className="mt-1 text-sm text-neutral-500">
              Automatically sign out inactive members after a set period.
            </p>
          </div>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  );
}
