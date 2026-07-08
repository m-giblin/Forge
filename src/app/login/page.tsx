"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type Screen = "credentials" | "totp";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Module-level so the React Compiler doesn't treat the window mutation as a component-render side effect. */
function navigateTo(url: string) {
  window.location.href = url;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const [ssoLoading, setSsoLoading] = useState<"google" | "microsoft" | "saml" | null>(null);
  const [samlAvailable, setSamlAvailable] = useState(false);

  async function signInWithOAuth(provider: "google" | "azure") {
    const label = provider === "google" ? "google" : "microsoft";
    setSsoLoading(label as "google" | "microsoft");
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
      setSsoLoading(null);
    }
    // On success Supabase redirects — no further action needed
  }

  async function signInWithSaml(domain: string) {
    setSsoLoading("saml");
    const { data, error } = await supabase.auth.signInWithSSO({
      domain,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error || !data?.url) {
      setError(error?.message ?? "SSO sign-in failed.");
      setSsoLoading(null);
      return;
    }
    navigateTo(data.url);
  }

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash.includes("type=recovery")) {
      router.replace(`/auth/reset-password${window.location.hash}`);
    }
  }, [router]);

  const [screen, setScreen] = useState<Screen>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Debounced check for a live SAML provider on this email's domain — shows a
  // "Continue with SSO" option only when one is actually registered.
  useEffect(() => {
    const domain = email.includes("@") ? email.split("@")[1]?.trim().toLowerCase() : "";
    const timer = setTimeout(() => {
      if (!domain || !domain.includes(".")) { setSamlAvailable(false); return; }
      fetch(`/api/auth/sso-check?domain=${encodeURIComponent(domain)}`)
        .then((r) => r.json())
        .then((d) => setSamlAvailable(!!d.available))
        .catch(() => setSamlAvailable(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [email]);
  const [totpCode, setTotpCode] = useState("");
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Sign in failed.");
      return;
    }

    // Check if this account has MFA enrolled and session is only at AAL1.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel === "aal1") {
      // Find the verified TOTP factor to challenge.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp?.[0];
      if (factor) {
        setPendingFactorId(factor.id);
        setScreen("totp");
        return;
      }
    }

    router.push(next);
    router.refresh();
  }

  async function onTotpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingFactorId) return;
    setError(null);
    setLoading(true);

    const { data: challenge, error: ce } = await supabase.auth.mfa.challenge({ factorId: pendingFactorId });
    if (ce || !challenge) { setLoading(false); setError(ce?.message ?? "Challenge failed."); return; }

    const { error: ve } = await supabase.auth.mfa.verify({
      factorId: pendingFactorId,
      challengeId: challenge.id,
      code: totpCode,
    });
    setLoading(false);
    if (ve) { setError("Invalid code. Check your authenticator app and try again."); return; }

    router.push(next);
    router.refresh();
  }

  if (screen === "totp") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-xl">🔐</div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Two-factor authentication</h1>
            <p className="mt-1 text-sm text-neutral-500">Enter the code from your authenticator app.</p>
          </div>
          <form
            onSubmit={onTotpSubmit}
            className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Authentication code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                autoFocus
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-center text-2xl font-mono tracking-[0.4em] outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
                placeholder="000000"
              />
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || totpCode.length !== 6}
              className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => { setScreen("credentials"); setTotpCode(""); setError(null); }}
              className="w-full text-center text-xs text-neutral-400 hover:text-neutral-600"
            >
              ← Back to sign in
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: "#EAE7D4" }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/forge-logo.svg" alt="Forge-Worx" className="mx-auto mb-2 h-64 w-64 object-contain drop-shadow-md" />
          <p className="text-sm text-neutral-500">Sign in to your workspace</p>
        </div>
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
              placeholder="you@example.com"
              suppressHydrationWarning
            />
          </div>
          {samlAvailable && (
            <button
              type="button"
              onClick={() => signInWithSaml(email.split("@")[1].trim().toLowerCase())}
              disabled={!!ssoLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60 transition"
            >
              🔒 {ssoLoading === "saml" ? "Redirecting…" : "Continue with your company's SSO"}
            </button>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              suppressHydrationWarning
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* SSO divider + buttons */}
        <div className="mt-4">
          <div className="relative flex items-center gap-3">
            <div className="h-px flex-1 bg-neutral-200" />
            <span className="text-xs text-neutral-400">or continue with</span>
            <div className="h-px flex-1 bg-neutral-200" />
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => signInWithOAuth("google")}
              disabled={!!ssoLoading}
              className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {ssoLoading === "google" ? "Redirecting…" : "Sign in with Google"}
            </button>
            <button
              type="button"
              onClick={() => signInWithOAuth("azure")}
              disabled={!!ssoLoading}
              className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 transition"
            >
              <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden="true">
                <path fill="#f25022" d="M0 0h11v11H0z"/>
                <path fill="#00a4ef" d="M12 0h11v11H12z"/>
                <path fill="#7fba00" d="M0 12h11v11H0z"/>
                <path fill="#ffb900" d="M12 12h11v11H12z"/>
              </svg>
              {ssoLoading === "microsoft" ? "Redirecting…" : "Sign in with Microsoft"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
