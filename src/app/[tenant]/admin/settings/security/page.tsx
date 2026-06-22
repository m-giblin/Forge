"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

export default function SecuritySettingsPage() {
  const { tenant: slug } = useParams<{ tenant: string }>();

  // --- MFA state ---
  const [requireMfa, setRequireMfa] = useState(false);
  const [mfaLoaded, setMfaLoaded] = useState(false);
  const [mfaSaving, setMfaSaving] = useState(false);
  const [mfaSaved, setMfaSaved] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  // --- IP allowlist state ---
  const [ipEntries, setIpEntries] = useState<string[]>([]);
  const [ipLoaded, setIpLoaded] = useState(false);
  const [ipRaw, setIpRaw] = useState(""); // textarea content
  const [ipSaving, setIpSaving] = useState(false);
  const [ipSaved, setIpSaved] = useState(false);
  const [ipError, setIpError] = useState<string | null>(null);
  const ipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/admin/security?tenant=${slug}`)
      .then((r) => r.json())
      .then((d) => { setRequireMfa(d.requireMfa ?? false); setMfaLoaded(true); });
    fetch(`/api/admin/ip-allowlist?tenant=${slug}`)
      .then((r) => r.json())
      .then((d) => {
        const entries: string[] = Array.isArray(d.entries) ? d.entries : [];
        setIpEntries(entries);
        setIpRaw(entries.join("\n"));
        setIpLoaded(true);
      });
  }, [slug]);

  async function saveMfa(next: boolean) {
    setMfaSaving(true);
    setMfaSaved(false);
    setMfaError(null);
    const res = await fetch("/api/admin/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, requireMfa: next }),
    });
    setMfaSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMfaError(body.error ?? "Save failed.");
      return;
    }
    setRequireMfa(next);
    setMfaSaved(true);
    setTimeout(() => setMfaSaved(false), 3000);
  }

  async function saveIpAllowlist() {
    setIpSaving(true);
    setIpSaved(false);
    setIpError(null);
    const entries = ipRaw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    const res = await fetch("/api/admin/ip-allowlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, entries }),
    });
    setIpSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setIpError(body.error ?? "Save failed.");
      return;
    }
    setIpEntries(entries);
    setIpSaved(true);
    if (ipTimerRef.current) clearTimeout(ipTimerRef.current);
    ipTimerRef.current = setTimeout(() => setIpSaved(false), 3000);
  }

  async function clearIpAllowlist() {
    setIpSaving(true);
    setIpError(null);
    await fetch("/api/admin/ip-allowlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    setIpEntries([]);
    setIpRaw("");
    setIpSaving(false);
    setIpSaved(true);
    if (ipTimerRef.current) clearTimeout(ipTimerRef.current);
    ipTimerRef.current = setTimeout(() => setIpSaved(false), 3000);
  }

  if (!mfaLoaded || !ipLoaded) return <div className="text-sm text-neutral-400">Loading…</div>;

  const ipEnabled = ipEntries.length > 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Security</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Enforce security policies for everyone in this workspace.
        </p>
      </div>

      {/* MFA card */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="p-5 flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-neutral-900">Require two-factor authentication</p>
              {requireMfa ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Enforced</span>
              ) : (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">Off</span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-neutral-500">
              When enabled, every member must enroll a TOTP authenticator app and pass a code
              challenge on every login. Users without enrollment are blocked until they enroll.
            </p>
            {requireMfa && (
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠ MFA is currently enforced. Members without an enrolled authenticator will be
                blocked at their next login until they enroll.
              </p>
            )}
          </div>
          <button
            onClick={() => saveMfa(!requireMfa)}
            disabled={mfaSaving}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
              requireMfa
                ? "border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                : "bg-neutral-900 text-white hover:bg-neutral-800"
            }`}
          >
            {mfaSaving ? "Saving…" : requireMfa ? "Disable" : "Enable"}
          </button>
        </div>
        {mfaSaved && (
          <div className="border-t border-emerald-100 bg-emerald-50 px-5 py-2.5 text-sm text-emerald-700">
            ✓ Saved — changes take effect on the next login for each member.
          </div>
        )}
        {mfaError && (
          <div className="border-t border-red-100 bg-red-50 px-5 py-2.5 text-sm text-red-700">
            {mfaError}
          </div>
        )}
      </div>

      {/* IP allowlist card */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-neutral-900">IP allowlist</p>
            {ipEnabled ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Active</span>
            ) : (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">Off</span>
            )}
          </div>
          <p className="text-sm text-neutral-500 mb-3">
            Restrict workspace access to specific IP addresses or CIDR ranges. Workspace owners
            are never blocked. Leave empty to allow access from any IP.
          </p>
          <textarea
            value={ipRaw}
            onChange={(e) => setIpRaw(e.target.value)}
            rows={5}
            placeholder={"192.168.1.0/24\n10.0.0.1\n203.0.113.42"}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-y"
          />
          <p className="mt-1.5 text-xs text-neutral-400">
            One entry per line. Supports exact IPs and IPv4 CIDR notation (e.g. 10.0.0.0/8).
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={saveIpAllowlist}
              disabled={ipSaving}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition"
            >
              {ipSaving ? "Saving…" : "Save allowlist"}
            </button>
            {ipEnabled && (
              <button
                onClick={clearIpAllowlist}
                disabled={ipSaving}
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 transition"
              >
                Remove all restrictions
              </button>
            )}
          </div>
          {ipEnabled && (
            <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠ IP restriction is active. Members connecting from outside the allowlist will be
              denied access. Workspace owners are exempt.
            </p>
          )}
        </div>
        {ipSaved && (
          <div className="border-t border-emerald-100 bg-emerald-50 px-5 py-2.5 text-sm text-emerald-700">
            ✓ Saved — IP restrictions apply immediately.
          </div>
        )}
        {ipError && (
          <div className="border-t border-red-100 bg-red-50 px-5 py-2.5 text-sm text-red-700">
            {ipError}
          </div>
        )}
      </div>

      {/* Session timeout placeholder */}
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
