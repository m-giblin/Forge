"use client";

import { useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function WaitlistForm({ variant = "dark" }: { variant?: "dark" | "hero" }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit() {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto flex max-w-[420px] items-center gap-2.5 rounded-lg border border-[#3f7d4c]/40 bg-[#3f7d4c]/[0.14] px-[18px] py-3.5 text-[13.5px] font-semibold text-[#9fd4a8]">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9fd4a8" strokeWidth="3" className="shrink-0">
          <path d="M5 13l4 4L19 7" />
        </svg>
        You&apos;re on the list — we&apos;ll email {email} the moment we launch.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[420px]">
      <div className="flex gap-2.5">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="you@company.com"
          disabled={submitting}
          className="flex-1 rounded-md border border-[#3a382f] bg-[#181a16] px-3.5 py-[13px] text-sm text-[#f2eee2] outline-none placeholder:text-[#5c594c] focus:border-[#8c4632] disabled:opacity-60"
        />
        <button
          onClick={submit}
          disabled={submitting}
          className="whitespace-nowrap rounded-md border border-[#5e2c1f] px-[22px] py-[13px] text-sm font-bold text-[#f2e9d8] transition hover:brightness-110 disabled:opacity-60"
          style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
        >
          {submitting ? "…" : "Notify me"}
        </button>
      </div>
      {error && <div className="mt-2 text-left text-xs text-[#e29a7e]">{error}</div>}
      {variant === "hero" && (
        <div className="mt-3.5 text-xs text-[#736e5c]">No spam. One email, right when we launch.</div>
      )}
    </div>
  );
}
