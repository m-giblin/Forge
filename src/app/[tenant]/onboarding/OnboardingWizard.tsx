"use client";

import { useState, useTransition } from "react";
import { claimFirstIssueAction, completeOnboardingAction } from "./actions";

interface Props {
  slug: string;
  userName: string;
  tenantName: string;
  members: Array<{ name: string; role: string }>;
  projects: Array<{ key: string; name: string; openIssueCount: number }>;
  openIssueCount: number;
  suggestedIssue: {
    id: string;
    key: string;
    title: string;
    description: string | null;
    priority: string;
    projectKey: string;
  } | null;
}

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-blue-500",
  "bg-teal-500",
  "bg-orange-500",
];

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-blue-100 text-blue-700",
  urgent: "bg-red-200 text-red-800",
};

export default function OnboardingWizard({
  slug,
  userName,
  tenantName,
  members,
  projects,
  openIssueCount,
  suggestedIssue,
}: Props) {
  const [step, setStep] = useState(1);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalSteps = 4;
  const progressPct = (step / totalSteps) * 100;

  function next() {
    setStep((s) => Math.min(s + 1, totalSteps));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 1));
  }

  function handleComplete() {
    startTransition(async () => {
      await completeOnboardingAction(slug);
    });
  }

  function handleClaim(issueId: string) {
    startTransition(async () => {
      await claimFirstIssueAction(slug, issueId);
    });
  }

  // Team pulse bullets from real data
  const teamPulse = [
    `${members.length} teammate${members.length !== 1 ? "s" : ""} in this workspace`,
    `${projects.length} active project${projects.length !== 1 ? "s" : ""} underway`,
    `${openIssueCount} open issue${openIssueCount !== 1 ? "s" : ""} to tackle`,
  ];

  return (
    <div className="min-h-[calc(100vh-64px)] bg-neutral-50 py-12 px-4">
      <div className="mx-auto max-w-2xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="h-1.5 w-full rounded-full bg-neutral-200">
            <div
              className="h-1.5 rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-2 text-right text-xs text-neutral-400">Step {step} of {totalSteps}</p>
        </div>

        {/* Step 1 — Welcome */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 p-8 text-white shadow-sm">
              <h1 className="text-3xl font-bold mb-2">👋 Hey {userName}!</h1>
              <p className="text-indigo-100 text-lg">
                You&apos;ve been invited to join <span className="font-semibold text-white">{tenantName}</span>&apos;s workspace.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm text-center">
                <div className="text-3xl font-bold text-indigo-600">{projects.length}</div>
                <div className="text-sm text-neutral-500 mt-1">Active projects</div>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm text-center">
                <div className="text-3xl font-bold text-violet-600">{openIssueCount}</div>
                <div className="text-sm text-neutral-500 mt-1">Open issues</div>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm text-center">
                <div className="text-3xl font-bold text-emerald-600">{members.length}</div>
                <div className="text-sm text-neutral-500 mt-1">Teammates</div>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Team pulse</h2>
              <ul className="space-y-2">
                {teamPulse.map((bullet, i) => (
                  <li key={i} className="flex items-center gap-2 text-neutral-700">
                    <span className="h-2 w-2 rounded-full bg-indigo-400 shrink-0" />
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end">
              <button
                onClick={next}
                className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Meet the Team */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-neutral-900 mb-5">Meet your teammates</h2>
              <ul className="space-y-3">
                {members.map((m, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(m.name)}`}
                    >
                      {initials(m.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-neutral-900 truncate block">{m.name}</span>
                    </div>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 capitalize">
                      {m.role}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Online now
                    </span>
                  </li>
                ))}
                {members.length === 0 && (
                  <li className="text-sm text-neutral-400">No teammates yet.</li>
                )}
              </ul>
            </div>

            <div className="flex justify-between">
              <button
                onClick={back}
                className="rounded-lg border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={next}
                className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Active Projects */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-neutral-900 mb-5">Choose a project to focus on</h2>
              <ul className="space-y-3">
                {projects.map((p) => (
                  <li key={p.key}>
                    <button
                      onClick={() => setSelectedProject(p.key)}
                      className={`w-full text-left flex items-center gap-4 rounded-lg border p-4 transition-colors ${
                        selectedProject === p.key
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-neutral-200 hover:border-indigo-300 hover:bg-neutral-50"
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 font-bold text-lg">
                        {p.key[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-neutral-900">{p.name}</div>
                        <div className="text-xs text-neutral-500 mt-0.5">{p.key}</div>
                      </div>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                        {p.openIssueCount} open
                      </span>
                    </button>
                  </li>
                ))}
                {projects.length === 0 && (
                  <li className="text-sm text-neutral-400">No active projects yet.</li>
                )}
              </ul>
            </div>

            <div className="flex justify-between">
              <button
                onClick={back}
                className="rounded-lg border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
              >
                ← Back
              </button>
              <div className="flex gap-3">
                <button
                  onClick={next}
                  className="rounded-lg border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={next}
                  className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4 — Your First Issue */}
        {step === 4 && (
          <div className="space-y-6">
            {!suggestedIssue ? (
              <div className="rounded-xl border border-neutral-200 bg-white p-8 shadow-sm text-center">
                <div className="text-4xl mb-3">🎉</div>
                <h2 className="text-xl font-semibold text-neutral-900 mb-2">You&apos;re all set!</h2>
                <p className="text-neutral-500 mb-6">Head to your dashboard to start exploring.</p>
                <button
                  onClick={handleComplete}
                  disabled={isPending}
                  className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
                >
                  {isPending ? "Loading…" : "Go to my dashboard"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-medium">
                  🎯 We picked a good first issue for you
                </div>

                <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-mono text-neutral-600">
                      {suggestedIssue.key}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        PRIORITY_COLORS[suggestedIssue.priority] ?? "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {suggestedIssue.priority}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-neutral-900 mb-2">{suggestedIssue.title}</h3>
                  {suggestedIssue.description && (
                    <p className="text-sm text-neutral-500">
                      {suggestedIssue.description.slice(0, 100)}
                      {suggestedIssue.description.length > 100 ? "…" : ""}
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleClaim(suggestedIssue!.id)}
                    disabled={isPending}
                    className="flex-1 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
                  >
                    {isPending ? "Claiming…" : "Claim this issue"}
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={isPending}
                    className="flex-1 rounded-lg border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-60"
                  >
                    Go to my dashboard
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-start">
              <button
                onClick={back}
                className="rounded-lg border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* Step dots */}
        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: totalSteps }, (_, i) => {
            const dotStep = i + 1;
            return (
              <span
                key={dotStep}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  dotStep === step
                    ? "bg-indigo-600"
                    : dotStep < step
                    ? "border-2 border-indigo-600 bg-white"
                    : "bg-neutral-300"
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
