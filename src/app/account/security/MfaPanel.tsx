"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type EnrollStep = "idle" | "qr" | "verify" | "done";

type Factor = { id: string; friendly_name: string | null; factor_type: string };

export default function MfaPanel() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [factors, setFactors] = useState<Factor[]>([]);
  const [step, setStep] = useState<EnrollStep>("idle");
  const [qrSvg, setQrSvg] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function loadFactors() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
    setLoaded(true);
  }

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      setFactors((data?.totp ?? []) as Factor[]);
      setLoaded(true);
    });
  // supabase instance is stable for the lifetime of the component
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startEnroll() {
    setError(null);
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "Forge" });
    setBusy(false);
    if (error || !data) { setError(error?.message ?? "Enrollment failed."); return; }

    // Generate QR via server action to keep qrcode on server side
    const res = await fetch("/api/auth/mfa/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uri: data.totp.uri }),
    });
    const { svg } = await res.json();

    setFactorId(data.id);
    setSecret(data.totp.secret);
    setQrSvg(svg);
    setStep("qr");
  }

  async function verifyEnroll() {
    if (code.length !== 6) { setError("Enter the 6-digit code from your authenticator app."); return; }
    setError(null);
    setBusy(true);

    const { data: challenge, error: ce } = await supabase.auth.mfa.challenge({ factorId });
    if (ce || !challenge) { setBusy(false); setError(ce?.message ?? "Challenge failed."); return; }

    const { error: ve } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    setBusy(false);
    if (ve) { setError(ve.message); return; }

    await loadFactors();
    setStep("done");
    setCode("");
  }

  async function unenroll(id: string) {
    if (!confirm("Disable two-factor authentication? You can re-enable it at any time.")) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setBusy(false);
    if (error) { setError(error.message); return; }
    await loadFactors();
    setStep("idle");
  }

  if (!loaded) return <div className="text-sm text-neutral-400">Loading…</div>;

  const hasMfa = factors.length > 0;

  return (
    <div className="space-y-6">
      {/* Current status */}
      <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-5">
        <div>
          <p className="font-semibold text-neutral-900">Two-factor authentication</p>
          <p className="mt-0.5 text-sm text-neutral-500">
            {hasMfa
              ? "Your account is protected with an authenticator app."
              : "Add an extra layer of security to your account."}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            hasMfa ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"
          }`}
        >
          {hasMfa ? "Enabled" : "Disabled"}
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Enabled — show enrolled factors + unenroll */}
      {hasMfa && (
        <div className="space-y-2">
          {factors.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">🔐</span>
                <div>
                  <p className="text-sm font-medium text-neutral-800">
                    {f.friendly_name || "Authenticator app"}{/* friendly_name */}
                  </p>
                  <p className="text-xs text-neutral-400">TOTP</p>
                </div>
              </div>
              <button
                onClick={() => unenroll(f.id)}
                disabled={busy}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Not enrolled — enrollment flow */}
      {!hasMfa && step === "idle" && (
        <button
          onClick={startEnroll}
          disabled={busy}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-neutral-300 transition"
        >
          {busy ? "Starting…" : "Enable 2FA"}
        </button>
      )}

      {step === "qr" && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 space-y-5">
          <div>
            <p className="font-semibold text-neutral-900">Scan this QR code</p>
            <p className="mt-1 text-sm text-neutral-500">
              Open your authenticator app (Google Authenticator, Authy, 1Password, etc.) and scan the code below.
            </p>
          </div>
          <div
            className="flex justify-center"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <details className="text-xs text-neutral-500">
            <summary className="cursor-pointer select-none hover:text-neutral-700">
              Can&apos;t scan? Enter manually
            </summary>
            <p className="mt-2 rounded-md bg-neutral-50 p-3 font-mono tracking-wider break-all">
              {secret}
            </p>
          </details>
          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">Enter the 6-digit code to confirm</p>
            <div className="flex gap-3">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && verifyEnroll()}
                placeholder="000000"
                className="w-36 rounded-lg border border-neutral-200 px-3 py-2 text-center text-lg font-mono tracking-widest outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
              />
              <button
                onClick={verifyEnroll}
                disabled={busy || code.length !== 6}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-neutral-300 transition"
              >
                {busy ? "Verifying…" : "Verify"}
              </button>
              <button
                onClick={() => { setStep("idle"); setCode(""); setError(null); }}
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="font-semibold text-emerald-800">✓ Two-factor authentication enabled</p>
          <p className="mt-1 text-sm text-emerald-700">
            Your account is now protected. You&apos;ll be asked for a code each time you sign in.
          </p>
        </div>
      )}
    </div>
  );
}
