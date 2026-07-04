"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const RichEditor = dynamic(() => import("@/components/spaces/RichEditor"), { ssr: false });

type SharedPage = {
  id: string; title: string; body: string; icon: string | null;
  updated_at: string; spaces: { name: string; icon: string } | null;
} | null;

export default function GuestPageClient({
  shareId, magicToken, allowedDomain, page,
}: {
  shareId: string;
  magicToken: string | null;
  allowedDomain: string | null;
  page: SharedPage;
}) {
  const [phase, setPhase] = useState<"loading" | "gate" | "requesting" | "check-email" | "verifying" | "view" | "error">("loading");
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(`forge-guest-${shareId}`);

    async function boot() {
      // 1. Check stored session
      if (stored) {
        const res = await fetch("/api/spaces/guest/verify/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionToken: stored, shareId }),
        });
        const json = await res.json();
        if (json.valid) { setSessionToken(stored); setPhase("view"); return; }
        sessionStorage.removeItem(`forge-guest-${shareId}`);
      }

      // 2. Magic token in URL → verify immediately
      if (magicToken) {
        setPhase("verifying");
        const res = await fetch("/api/spaces/guest/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: magicToken, shareId }),
        });
        const json = await res.json();
        if (json.sessionToken) {
          sessionStorage.setItem(`forge-guest-${shareId}`, json.sessionToken);
          setSessionToken(json.sessionToken);
          // Clean token from URL without reload
          window.history.replaceState({}, "", `/shared/page?share=${shareId}`);
          setPhase("view");
        } else {
          setErrorMsg(json.error ?? "This link has expired. Please request a new one.");
          setPhase("gate");
        }
        return;
      }

      // 3. No token, no session → prompt for email
      setPhase("gate");
    }

    boot();
  }, [magicToken, shareId]);

  async function requestAccess() {
    if (!email.trim()) return;
    setPhase("requesting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/spaces/guest/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId, email: email.trim() }),
      });
      const json = await res.json();
      if (json.error) { setErrorMsg(json.error); setPhase("gate"); return; }
      setPhase("check-email");
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setPhase("gate");
    }
  }

  if (phase === "loading" || phase === "verifying") {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
      </div>
    );
  }

  if (phase === "check-email") {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="text-4xl mb-4">📬</div>
          <h1 className="text-lg font-semibold text-neutral-900 mb-2">Check your email</h1>
          <p className="text-sm text-neutral-500 mb-4">
            We sent a secure access link to <strong>{email}</strong>. It expires in 1 hour.
          </p>
          <p className="text-xs text-neutral-400">Didn&apos;t receive it? Check spam or <button onClick={() => setPhase("gate")} className="underline">try again</button>.</p>
        </div>
      </div>
    );
  }

  if (phase === "gate" || phase === "requesting") {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Forge branding */}
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">{page?.icon ?? "📄"}</div>
            {page && <h2 className="text-lg font-semibold text-neutral-900">{page.title}</h2>}
            {page?.spaces && <p className="text-sm text-neutral-500 mt-0.5">{page.spaces.icon} {page.spaces.name}</p>}
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
            <h1 className="text-base font-semibold text-neutral-900 mb-1">Request read-only access</h1>
            <p className="text-sm text-neutral-500 mb-4">
              Enter your{allowedDomain ? ` @${allowedDomain}` : " company"} email to receive a secure access link.
            </p>

            <div className="mb-4 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700 space-y-0.5">
              <p>🔒 <strong>Read-only</strong> — you cannot edit or modify anything</p>
              <p>⏱️ <strong>48-hour session</strong> — access expires automatically</p>
              {allowedDomain && <p>📧 <strong>@{allowedDomain} only</strong> — restricted to your organization</p>}
            </div>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && requestAccess()}
              placeholder={`you@${allowedDomain ?? "company.com"}`}
              className="mb-3 w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              autoFocus
            />

            {errorMsg && <p className="mb-3 text-sm text-red-600">{errorMsg}</p>}

            <button
              onClick={requestAccess}
              disabled={!email.trim() || phase === "requesting"}
              className="w-full rounded-xl bg-neutral-900 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50 transition"
            >
              {phase === "requesting" ? "Sending…" : "Send access link →"}
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-neutral-400">
            Powered by{" "}
            <a href="https://forge-worx.com" className="font-semibold text-neutral-600 hover:underline">
              Forge-Worx
            </a>
          </p>
        </div>
      </div>
    );
  }

  // phase === "view"
  if (!page) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <p className="text-neutral-500">Page not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Read-only banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-700 font-medium">
        👁️ You have read-only access to this page via Forge-Worx Spaces
      </div>

      {/* Page content */}
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-6">
          {page.spaces && (
            <p className="text-sm text-neutral-400 mb-3">
              {page.spaces.icon} {page.spaces.name}
            </p>
          )}
          <h1 className="text-3xl font-bold text-neutral-900 mb-2 flex items-center gap-3">
            {page.icon && <span>{page.icon}</span>}
            {page.title}
          </h1>
          <p className="text-xs text-neutral-400">
            Last updated {new Date(page.updated_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <RichEditor
            content={page.body}
            onChange={() => {}}
            readOnly
          />
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-neutral-400">
            Powered by{" "}
            <a href="https://forge-worx.com" className="font-semibold text-neutral-600 hover:underline">
              Forge-Worx
            </a>{" "}
            · Your session expires in 48 hours
          </p>
        </div>
      </div>
    </div>
  );
}
