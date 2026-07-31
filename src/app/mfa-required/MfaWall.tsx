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
    <main className="flex min-h-screen items-center justify-center bg-[var(--fw-cream)] px-4 font-[family-name:var(--font-inter)]">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--fw-sidebar-3)] text-2xl">
            🔐
          </div>
          <h1 className="font-[family-name:var(--font-manrope)] text-2xl font-extrabold tracking-tight text-[#20201d]">
            {mode === "challenge" ? "Verify your identity" : "Set up two-factor authentication"}
          </h1>
          <p className="mt-2 text-sm text-[#726e60]">
            {mode === "challenge"
              ? "Your workspace requires two-factor authentication. Enter the code from your authenticator app."
              : "Your workspace requires 2FA. Enroll an authenticator app to continue."}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--fw-cream-border)] bg-white p-6 shadow-sm space-y-5">

          {/* Challenge mode */}
          {mode === "challenge" && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#4a473e]">
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
                  className="w-full rounded-lg border border-[var(--fw-cream-border)] px-3 py-3 text-center text-2xl font-mono tracking-[0.4em] outline-none focus:border-[var(--fw-rust)] focus:ring-1 focus:ring-[var(--fw-rust)]"
                />
              </div>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
              <button
                onClick={verify}
                disabled={busy || code.length !== 6}
                className="w-full rounded-lg border border-[var(--fw-rust-border)] px-4 py-2.5 text-sm font-medium text-[#f2e9d8] transition disabled:opacity-50"
                style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
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
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
              <button
                onClick={startEnroll}
                disabled={busy}
                className="w-full rounded-lg border border-[var(--fw-rust-border)] px-4 py-2.5 text-sm font-medium text-[#f2e9d8] transition disabled:opacity-50"
                style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
              >
                {busy ? "Setting up…" : "Set up authenticator app"}
              </button>
            </>
          )}

          {/* Enroll — show QR, collect verify code */}
          {mode === "enroll-verify" && (
            <>
              <div>
                <p className="text-sm font-medium text-[#4a473e] mb-3">
                  Scan this QR code with your authenticator app
                </p>
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="QR code for authenticator app" width={200} height={200} />
                </div>
                <details className="mt-3 text-xs text-[#726e60]">
                  <summary className="cursor-pointer select-none hover:text-[#4a473e]">
                    Can&apos;t scan? Enter manually
                  </summary>
                  <p className="mt-2 rounded-md bg-[var(--fw-cream-bg)] p-3 font-mono tracking-wider break-all">
                    {secret}
                  </p>
                </details>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#4a473e]">
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
                  className="w-full rounded-lg border border-[var(--fw-cream-border)] px-3 py-3 text-center text-2xl font-mono tracking-[0.4em] outline-none focus:border-[var(--fw-rust)] focus:ring-1 focus:ring-[var(--fw-rust)]"
                />
              </div>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
              <button
                onClick={verify}
                disabled={busy || code.length !== 6}
                className="w-full rounded-lg border border-[var(--fw-rust-border)] px-4 py-2.5 text-sm font-medium text-[#f2e9d8] transition disabled:opacity-50"
                style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
              >
                {busy ? "Verifying…" : "Verify and continue"}
              </button>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-[#a19d90]">
          Contact your workspace admin if you&apos;re having trouble.
        </p>
      </div>
    </main>
  );
}
