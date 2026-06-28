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

export default function SignupPage() {
  const [workspaceName, setWorkspaceName] = useState("");
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const [checkedSlug, setCheckedSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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

    setLoading(true);

    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim().toLowerCase();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    // Step 1: Create user + tenant
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, workspaceName: workspaceName.trim(), email, password }),
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
        <p className="mt-1.5 text-xs text-slate-500">
          Workspace URL: <span className="text-slate-400">/{checkedSlug}</span>
        </p>
      );
    }
    if (slugState === "checking") {
      return (
        <p className="mt-1.5 text-xs text-slate-400">
          Checking <span className="text-slate-300">/{checkedSlug}</span>&hellip;
        </p>
      );
    }
    if (slugState === "available") {
      return (
        <p className="mt-1.5 text-xs">
          <span className="text-green-400 font-semibold">✓ Available</span>
          <span className="text-slate-400"> — your workspace: </span>
          <span className="text-indigo-400 font-medium">/{checkedSlug}</span>
        </p>
      );
    }
    if (slugState === "taken") {
      return (
        <p className="mt-1.5 text-xs">
          <span className="text-red-400 font-semibold">✗ Already taken</span>
          <span className="text-slate-500"> — try a different name, e.g. &ldquo;{workspaceName.trim()} Team&rdquo;</span>
        </p>
      );
    }
    return null;
  };

  const canSubmit = !loading && slugState !== "taken" && slugState !== "checking";

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Minimal nav */}
      <header className="border-b border-slate-800 px-6 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500">
            <span className="text-xs font-black text-white">F</span>
          </div>
          <span className="text-sm font-bold text-white">Forge<span className="text-indigo-400">-Worx</span></span>
        </Link>
        <p className="text-sm text-slate-400">
          Already a customer?{" "}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Sign in
          </Link>
        </p>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-indigo-300 uppercase mb-5">
              14-day free Premium trial
            </div>
            <h1 className="text-3xl font-black text-white mb-2">Create your workspace</h1>
            <p className="text-slate-400 text-sm">
              Full Premium. Single workspace. No credit card required.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Your full name</label>
              <input
                name="name"
                type="text"
                required
                autoComplete="name"
                placeholder="Jane Smith"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Work email</label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="jane@company.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Workspace name</label>
              <input
                name="workspaceName"
                type="text"
                required
                placeholder="Acme Engineering"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className={`w-full rounded-xl border px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition bg-slate-900 ${
                  slugState === "taken"
                    ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/40"
                    : slugState === "available"
                    ? "border-green-500/60 focus:border-green-500 focus:ring-green-500/40"
                    : "border-slate-700 focus:border-indigo-500 focus:ring-indigo-500"
                }`}
              />
              {slugHint()}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="8+ characters"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-xl bg-indigo-500 py-3 text-sm font-bold text-white hover:bg-indigo-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading
                ? "Creating your workspace…"
                : slugState === "checking"
                ? "Checking availability…"
                : "Start 14-Day Free Trial →"}
            </button>
          </form>

          {/* Trust signals */}
          <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs text-slate-500">
            <div className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-2.5">
              <div className="text-base mb-1">🔒</div>
              No credit card
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-2.5">
              <div className="text-base mb-1">⚡</div>
              Live in 2 minutes
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-2.5">
              <div className="text-base mb-1">📊</div>
              Full Premium
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-600">
            By signing up you agree to our{" "}
            <Link href="/legal/terms" className="text-slate-500 hover:text-slate-400 underline">Terms of Service</Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="text-slate-500 hover:text-slate-400 underline">Privacy Policy</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
