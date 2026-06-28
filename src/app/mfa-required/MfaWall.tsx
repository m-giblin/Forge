"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type Mode = "challenge" | "enroll" | "enroll-verify";

export default function MfaWall({
  hasFactor,
  factorId: initialFactorId,
  next,
}: {
  hasFactor: boolean;
  factorId: string | null;
  next: string;
}) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [mode, setMode] = useState<Mode>(hasFactor ? "challenge" : "enroll");
  const [factorId, setFactorId] = useState<string | null>(initialFactorId);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // --- Enrollment ---
  async function startEnroll() {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "Forge" });
    if (error || !data) { setBusy(false); setError(error?.message ?? "Enrollment failed."); return; }

    const res = await fetch("/api/auth/mfa/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uri: data.totp.uri }),
    });
    const { dataUrl } = await res.json();
    setBusy(false);
    setFactorId(data.id);
    setSecret(data.totp.secret);
    setQrDataUrl(dataUrl);
    setMode("enroll-verify");
  }

  // --- Verify (works for both challenge and enroll-verify) ---
  async function verify() {
    if (!factorId || code.length !== 6) return;
    setBusy(true);
    setError(null);

    const { data: challenge, error: ce } = await supabase.auth.mfa.challenge({ factorId });
    if (ce || !challenge) { setBusy(false); setError(ce?.message ?? "Challenge failed."); return; }

    const { error: ve } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    setBusy(false);
    if (ve) { setError("Invalid code — check your authenticator app and try again."); return; }

    router.push(next);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-2xl">
            🔐
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">
            {mode === "challenge" ? "Verify your identity" : "Set up two-factor authentication"}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            {mode === "challenge"
              ? "Your workspace requires two-factor authentication. Enter the code from your authenticator app."
              : "Your workspace requires 2FA. Enroll an authenticator app to continue."}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm space-y-5">

          {/* Challenge mode */}
          {mode === "challenge" && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Authentication code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && verify()}
                  placeholder="000000"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-center text-2xl font-mono tracking-[0.4em] outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
                />
              </div>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <button
                onClick={verify}
                disabled={busy || code.length !== 6}
                className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition"
              >
                {busy ? "Verifying…" : "Verify and continue"}
              </button>
            </>
          )}

          {/* Enroll — prompt to start */}
          {mode === "enroll" && (
            <>
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                Your workspace admin has made 2FA mandatory. You must enroll an authenticator
                app before you can continue.
              </div>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <button
                onClick={startEnroll}
                disabled={busy}
                className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition"
              >
                {busy ? "Setting up…" : "Set up authenticator app"}
              </button>
            </>
          )}

          {/* Enroll — show QR, collect verify code */}
          {mode === "enroll-verify" && (
            <>
              <div>
                <p className="text-sm font-medium text-neutral-700 mb-3">
                  Scan this QR code with your authenticator app
                </p>
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="QR code for authenticator app" width={200} height={200} />
                </div>
                <details className="mt-3 text-xs text-neutral-500">
                  <summary className="cursor-pointer select-none hover:text-neutral-700">
                    Can&apos;t scan? Enter manually
                  </summary>
                  <p className="mt-2 rounded-md bg-neutral-50 p-3 font-mono tracking-wider break-all">
                    {secret}
                  </p>
                </details>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Enter the 6-digit code to confirm
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && verify()}
                  placeholder="000000"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-center text-2xl font-mono tracking-[0.4em] outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
                />
              </div>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <button
                onClick={verify}
                disabled={busy || code.length !== 6}
                className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition"
              >
                {busy ? "Verifying…" : "Verify and continue"}
              </button>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-neutral-400">
          Contact your workspace admin if you&apos;re having trouble.
        </p>
      </div>
    </main>
  );
}
