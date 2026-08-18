"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

type SlugState = "idle" | "checking" | "available" | "taken" | "too_short";

export default function SignupPageClient() {
  const [workspaceName, setWorkspaceName] = useState("");
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const [checkedSlug, setCheckedSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced slug availability check
  useEffect(() => {
    const slug = slugify(workspaceName);
    const trimmed = workspaceName.trim();

    // Compute immediate state without calling setState synchronously inside the effect.
    // We use a single batched update via a microtask to satisfy React compiler rules.
    const immediate: { state: SlugState; slug: string } | null =
      !trimmed || !slug
        ? { state: "idle", slug: "" }
        : slug.length < 3
        ? { state: "too_short", slug }
        : null; // will do async check

    if (immediate) {
      const { state, slug: s } = immediate;
      queueMicrotask(() => { setSlugState(state); setCheckedSlug(s); });
      return;
    }

    // Async debounced check
    queueMicrotask(() => { setSlugState("checking"); setCheckedSlug(slug); });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/signup/check-slug?name=${encodeURIComponent(workspaceName)}`);
        const data = await res.json();
        setCheckedSlug(data.slug);
        setSlugState(data.available ? "available" : "taken");
      } catch {
        setSlugState("idle");
      }
    }, 450);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [workspaceName]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (slugState === "taken") {
      setError("That workspace name is already taken. Please choose a different name.");
      return;
    }
    if (!tosAccepted) {
      setError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }

    setLoading(true);

    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim().toLowerCase();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const phone = (form.elements.namedItem("phone") as HTMLInputElement).value.trim();

    // Step 1: Create user + tenant
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, workspaceName: workspaceName.trim(), email, password, phone, tosAccepted }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    // Step 2: Sign the user in (sets the session cookie via the existing login endpoint)
    const loginRes = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!loginRes.ok) {
      // Account was created but auto-login failed — redirect to login page
      window.location.href = `/login?next=${encodeURIComponent(`/${data.slug}/board`)}`;
      return;
    }

    // Step 3: Navigate to the new workspace
    window.location.href = `/${data.slug}/board`;
  }

  const slugHint = () => {
    if (slugState === "idle" || !workspaceName.trim()) return null;
    if (slugState === "too_short") {
      return (
        <p className="mt-1.5 text-xs text-[var(--fw-text-dimmer)]">
          Workspace URL: <span className="text-[var(--fw-text-dim)]">/{checkedSlug}</span>
        </p>
      );
    }
    if (slugState === "checking") {
      return (
        <p className="mt-1.5 text-xs text-[var(--fw-text-dim)]">
          Checking <span className="text-[var(--fw-text-bright)]">/{checkedSlug}</span>&hellip;
        </p>
      );
    }
    if (slugState === "available") {
      return (
        <p className="mt-1.5 text-xs">
          <span className="text-emerald-400 font-semibold">✓ Available</span>
          <span className="text-[var(--fw-text-dim)]"> — your workspace: </span>
          <span className="text-[#e29a7e] font-medium">/{checkedSlug}</span>
        </p>
      );
    }
    if (slugState === "taken") {
      return (
        <p className="mt-1.5 text-xs">
          <span className="text-red-400 font-semibold">✗ Already taken</span>
          <span className="text-[var(--fw-text-dimmer)]"> — try a different name, e.g. &ldquo;{workspaceName.trim()} Team&rdquo;</span>
        </p>
      );
    }
    return null;
  };

  const canSubmit = !loading && slugState !== "taken" && slugState !== "checking" && tosAccepted;
  const fieldClass = "w-full rounded-xl border border-[#3a382f] bg-[var(--fw-sidebar-2)] px-4 py-3 text-sm text-[var(--fw-text-bright)] placeholder-[var(--fw-text-dimmer)] focus:border-[var(--fw-rust)] focus:outline-none focus:ring-1 focus:ring-[var(--fw-rust)] transition";

  return (
    <div
      className="fw-grunge min-h-screen flex flex-col font-[family-name:var(--font-inter)]"
      style={{ background: "linear-gradient(165deg,#26281f 0%,#181a16 55%,#131412 100%)" }}
    >
      {/* Minimal nav */}
      <header className="border-b border-[var(--fw-sidebar-border)] px-6 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <img src="/forge-logo.svg" alt="Forge-Worx" className="h-10 w-10 object-contain drop-shadow-md" />
        </Link>
        <p className="text-sm text-[var(--fw-text-dim)]">
          Already a customer?{" "}
          <Link href="/login" className="text-[#e29a7e] hover:text-[#f0b39a] font-medium">
            Sign in
          </Link>
        </p>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--fw-rust)]/30 bg-[var(--fw-rust)]/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-[#e29a7e] uppercase mb-5">
              14-day free Premium trial
            </div>
            <h1 className="font-[family-name:var(--font-manrope)] text-3xl font-extrabold text-[var(--fw-text-bright)] mb-2">Create your workspace</h1>
            <p className="text-[var(--fw-text-dim)] text-sm">
              Full Premium. Single workspace. No credit card required.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--fw-text-dim)] mb-1.5">Your full name</label>
              <input
                name="name"
                type="text"
                required
                autoComplete="name"
                placeholder="Jane Smith"
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--fw-text-dim)] mb-1.5">Work email</label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="jane@company.com"
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--fw-text-dim)] mb-1.5">Phone number</label>
              <input
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                placeholder="(555) 123-4567"
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--fw-text-dim)] mb-1.5">Workspace name</label>
              <input
                name="workspaceName"
                type="text"
                required
                placeholder="Acme Engineering"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className={`w-full rounded-xl border px-4 py-3 text-sm text-[var(--fw-text-bright)] placeholder-[var(--fw-text-dimmer)] focus:outline-none focus:ring-1 transition bg-[var(--fw-sidebar-2)] ${
                  slugState === "taken"
                    ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/40"
                    : slugState === "available"
                    ? "border-emerald-500/60 focus:border-emerald-500 focus:ring-emerald-500/40"
                    : "border-[#3a382f] focus:border-[var(--fw-rust)] focus:ring-[var(--fw-rust)]"
                }`}
              />
              {slugHint()}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--fw-text-dim)] mb-1.5">Password</label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="8+ characters"
                className={fieldClass}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <label className="flex items-start gap-2.5 text-xs text-[var(--fw-text-dimmer)] cursor-pointer">
              <input
                type="checkbox"
                required
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--fw-rust)]"
              />
              <span>
                I agree to the{" "}
                <Link href="/legal/terms" target="_blank" className="text-[var(--fw-text-dim)] hover:text-[var(--fw-text-bright)] underline">Terms of Service</Link>{" "}
                and{" "}
                <Link href="/legal/privacy" target="_blank" className="text-[var(--fw-text-dim)] hover:text-[var(--fw-text-bright)] underline">Privacy Policy</Link>.
              </span>
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-xl border border-[var(--fw-rust-border)] py-3 text-sm font-bold text-[#f2e9d8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
            >
              {loading
                ? "Creating your workspace…"
                : slugState === "checking"
                ? "Checking availability…"
                : "Start 14-Day Free Trial →"}
            </button>
          </form>

          {/* Trust signals */}
          <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs text-[var(--fw-text-dimmer)]">
            <div className="rounded-lg border border-[#2a2820] bg-[var(--fw-sidebar-2)] px-2 py-2.5">
              <div className="text-base mb-1">🔒</div>
              No credit card
            </div>
            <div className="rounded-lg border border-[#2a2820] bg-[var(--fw-sidebar-2)] px-2 py-2.5">
              <div className="text-base mb-1">⚡</div>
              Live in 2 minutes
            </div>
            <div className="rounded-lg border border-[#2a2820] bg-[var(--fw-sidebar-2)] px-2 py-2.5">
              <div className="text-base mb-1">📊</div>
              Full Premium
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
