"use client";

import { useRef, useState, useCallback } from "react";
import PageHeader from "@/components/patterns/PageHeader";
import TogglesList from "@/components/patterns/admin/TogglesList";
import FormGrid, { type FormField } from "@/components/patterns/admin/FormGrid";
import Note from "@/components/patterns/admin/Note";

const SESSION_MIN = 15;
const SESSION_MAX = 480;

function minutesToDisplay(m: number): string {
  if (m < 60) return `${m} minutes`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h} hour${h !== 1 ? "s" : ""}` : `${h}h ${rem}m`;
}

export default function SecuritySettingsClient({
  slug,
  initialRequireMfa,
  initialIpEntries,
  initialSessionMinutes,
}: {
  slug: string;
  initialRequireMfa: boolean;
  initialIpEntries: string[];
  initialSessionMinutes: number;
}) {
  const [requireMfa, setRequireMfa] = useState(initialRequireMfa);
  const [, setMfaSaving] = useState(false);
  const [mfaSaved, setMfaSaved] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  const [sessionMinutes, setSessionMinutes] = useState(initialSessionMinutes);
  const [sessionSaving, setSessionSaving] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ipRaw, setIpRaw] = useState(initialIpEntries.join("\n"));
  const [ipEntries, setIpEntries] = useState(initialIpEntries);
  const [ipSaving, setIpSaving] = useState(false);
  const [ipSaved, setIpSaved] = useState(false);
  const [ipError, setIpError] = useState<string | null>(null);
  const ipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const saveSessionTimeout = useCallback(async (minutes: number) => {
    setSessionSaving(true);
    setSessionSaved(false);
    setSessionError(null);
    const res = await fetch("/api/admin/session-timeout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, minutes }),
    });
    setSessionSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSessionError(body.error ?? "Save failed.");
      return;
    }
    setSessionSaved(true);
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    // The idle-timeout guard is mounted once in the tenant layout and doesn't
    // re-read tenant_settings on client navigation, so a saved value only
    // takes effect in this tab after a full reload.
    sessionTimerRef.current = setTimeout(() => window.location.reload(), 800);
  }, [slug]);

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

  const ipEnabled = ipEntries.length > 0;

  function handleToggle(key: string, next: boolean) {
    if (key === "require-mfa") saveMfa(next);
    if (key === "restrict-ip") {
      if (!next) clearIpAllowlist();
      // turning on with no entries is a no-op until the admin fills in the form below
    }
  }

  const sessionFields: FormField[] = [
    {
      key: "timeout",
      label: "Session timeout",
      input: (
        <div className="space-y-1.5">
          <input
            type="range"
            min={SESSION_MIN}
            max={SESSION_MAX}
            step={15}
            value={sessionMinutes}
            onChange={(e) => setSessionMinutes(Number(e.target.value))}
            className="w-full accent-[#8c4632]"
          />
          <p className="text-[11.5px] font-semibold text-[#20201d]">{minutesToDisplay(sessionMinutes)}</p>
        </div>
      ),
    },
    {
      key: "warning",
      label: "Warning shown at",
      input: <p className="text-[12px] text-[#726e60]">{minutesToDisplay(Math.max(SESSION_MIN, sessionMinutes - 5))} of inactivity</p>,
    },
  ];

  const ipFields: FormField[] = [
    {
      key: "ip-entries",
      label: "Allowed IPs / CIDR ranges",
      input: (
        <textarea
          value={ipRaw}
          onChange={(e) => setIpRaw(e.target.value)}
          rows={4}
          placeholder={"192.168.1.0/24\n10.0.0.1\n203.0.113.42"}
          className="w-full resize-y rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] font-mono text-[11.5px] text-[#20201d] focus:outline-none focus:border-[#b7452f]"
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Security Settings" subtitle="Sessions, MFA and sign-in policy" />

      <div className="space-y-5 px-6">
        <TogglesList
          items={[
            {
              key: "require-mfa",
              label: "Require MFA",
              description: "Every member must enroll a second factor",
              on: requireMfa,
            },
            {
              key: "restrict-ip",
              label: "Restrict by IP",
              description: "Only allow sign-in from listed ranges",
              on: ipEnabled,
            },
          ]}
          onChange={handleToggle}
        />
        {mfaError && <Note icon="⚠" tone="error">{mfaError}</Note>}
        {mfaSaved && <Note icon="✓" tone="info">Saved — changes take effect on the next login for each member.</Note>}

        <div className="space-y-2.5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">IP allowlist</p>
          <FormGrid fields={ipFields} onSubmit={saveIpAllowlist} submitLabel={ipSaving ? "Saving…" : "Save allowlist"} />
          {ipEnabled && <Note icon="⚠" tone="warning">IP restriction is active. Members connecting from outside the allowlist will be denied access. Workspace owners are exempt.</Note>}
          {ipSaved && <Note icon="✓" tone="info">Saved — IP restrictions apply immediately.</Note>}
          {ipError && <Note icon="⚠" tone="error">{ipError}</Note>}
        </div>

        <div className="space-y-2.5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Session policy</p>
          <FormGrid fields={sessionFields} onSubmit={() => saveSessionTimeout(sessionMinutes)} submitLabel={sessionSaving ? "Saving…" : "Save"} />
          {sessionSaved && <Note icon="✓" tone="info">Saved — new timeout applies on the next page load for each member.</Note>}
          {sessionError && <Note icon="⚠" tone="error">{sessionError}</Note>}
        </div>
      </div>
    </div>
  );
}
