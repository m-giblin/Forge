"use client";

import { useState } from "react";
import Link from "next/link";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function SignupPage() {
  const [workspaceName, setWorkspaceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim().toLowerCase();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const wsName = (form.elements.namedItem("workspaceName") as HTMLInputElement).value.trim();

    if (!name || !email || !password || !wsName) {
      setError("All fields are required.");
      setLoading(false);
      return;
    }

    // Step 1: Create user + tenant
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, workspaceName: wsName, email, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    // Step 2: Sign the user in (sets the session cookie)
    const loginRes = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!loginRes.ok) {
      // Account was created but login failed — redirect to login page
      window.location.href = `/login?next=${encodeURIComponent(`/${data.slug}/board`)}`;
      return;
    }

    // Step 3: Navigate to the new workspace
    window.location.href = `/${data.slug}/board`;
  }

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
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
              />
              {workspaceName && (
                <p className="mt-1.5 text-xs text-slate-500">
                  Your workspace URL: <span className="text-indigo-400">app/<strong>{slugify(workspaceName)}</strong></span>
                </p>
              )}
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
              disabled={loading}
              className="w-full rounded-xl bg-indigo-500 py-3 text-sm font-bold text-white hover:bg-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating your workspace…" : "Start 14-Day Free Trial →"}
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
