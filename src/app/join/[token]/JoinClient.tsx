"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { acceptInviteAction, provisionInvitedAccountAction } from "./actions";

export default function JoinClient({
  token,
  tenantName,
  role,
  boundEmail,
  currentEmail,
}: {
  token: string;
  tenantName: string;
  role: string;
  boundEmail: string | null;
  currentEmail: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Auth form state (when signed out)
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState(boundEmail ?? "");
  const [password, setPassword] = useState("");

  function accept() {
    setError(null);
    startTransition(async () => {
      try {
        const { slug } = await acceptInviteAction(token);
        // Hard navigation, not router.push: a client transition can hang on
        // "Joining…" while the destination RSC compiles/loads (esp. over LAN).
        window.location.assign(`/${slug}/board`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not accept invite");
      }
    });
  }

  async function authThenRefresh(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        // Sign-up provisions an auto-confirmed account server-side (the invite
        // vouches for the email), then we sign in to establish the session.
        if (mode === "signup") {
          await provisionInvitedAccountAction(token, email, password);
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setError(error.message);
          return;
        }
        router.refresh(); // server re-renders; signed-in branch shows the Accept button
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not continue");
      }
    });
  }

  const intro = (
    <p className="mb-4 text-center text-sm text-[#726e60]">
      You&rsquo;ve been invited to join <span className="font-semibold text-[#20201d]">{tenantName}</span> as{" "}
      <span className="font-semibold capitalize">{role}</span>.
    </p>
  );

  // Signed in → accept
  if (currentEmail) {
    const mismatch = boundEmail && boundEmail.toLowerCase() !== currentEmail.toLowerCase();
    return (
      <div className="rounded-xl border border-[var(--fw-cream-border)] bg-white p-6 shadow-sm">
        {intro}
        <p className="mb-4 text-center text-xs text-[#a19d90]">Signed in as {currentEmail}</p>
        {mismatch ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            This invite is for {boundEmail}. Sign in with that address to accept.
          </p>
        ) : (
          <button
            onClick={accept}
            disabled={pending}
            className="w-full rounded-lg border border-[var(--fw-rust-border)] px-4 py-2 text-sm font-medium text-[#f2e9d8] transition disabled:opacity-50"
            style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
          >
            {pending ? "Joining…" : `Accept & join ${tenantName}`}
          </button>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // Signed out → create account or sign in
  return (
    <form onSubmit={authThenRefresh} className="rounded-xl border border-[var(--fw-cream-border)] bg-white p-6 shadow-sm">
      {intro}
      <div className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={!!boundEmail}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-[var(--fw-cream-border)] px-3 py-2 text-sm outline-none focus:border-[var(--fw-rust)] focus:ring-1 focus:ring-[var(--fw-rust)] read-only:bg-[var(--fw-cream-bg)]"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "signup" ? "Choose a password" : "Password"}
          className="w-full rounded-lg border border-[var(--fw-cream-border)] px-3 py-2 text-sm outline-none focus:border-[var(--fw-rust)] focus:ring-1 focus:ring-[var(--fw-rust)]"
        />
        <button
          type="submit"
          className="w-full rounded-lg border border-[var(--fw-rust-border)] px-4 py-2 text-sm font-medium text-[#f2e9d8] transition"
          style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
        >
          {mode === "signup" ? "Create account & continue" : "Sign in & continue"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={() => setMode((m) => (m === "signup" ? "signin" : "signup"))}
        className="mt-3 w-full text-center text-xs text-[#a19d90] hover:text-[#726e60]"
      >
        {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </form>
  );
}
