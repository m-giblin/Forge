"use client";
/* eslint-disable react/no-unescaped-entities -- interactive design prototype, not production copy */

import { useState } from "react";

export default function DesignPage() {
  const [activeDesign, setActiveDesign] = useState<"c" | "d" | "e" | "f" | "g">("g");

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Design Selector */}
      <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Forge Designs</h1>
          <p className="text-sm text-neutral-500 mt-1">E & F are the login dashboards. C & D are the idea→project workflows.</p>
        </div>
        <div className="flex gap-2">
          {[
            { id: "g" as const, label: "G: Project Portal" },
            { id: "e" as const, label: "E: Mission Control" },
            { id: "f" as const, label: "F: Delivery Intel" },
            { id: "c" as const, label: "C: Decision-Driven" },
            { id: "d" as const, label: "D: Async Consent" },
          ].map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveDesign(d.id)}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                activeDesign === d.id
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeDesign === "g" && <DesignG />}
        {activeDesign === "e" && <DesignE />}
        {activeDesign === "f" && <DesignF />}
        {activeDesign === "c" && <DesignC />}
        {activeDesign === "d" && <DesignD />}
      </div>
    </div>
  );
}

function DesignC() {
  const [step, setStep] = useState<"landing" | "idea-detail" | "decision-log" | "role-signoff">("landing");

  if (step === "landing") {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="bg-neutral-50 border-b border-neutral-200 px-8 py-6">
            <h2 className="text-2xl font-semibold text-neutral-900">Forge Hub</h2>
            <p className="text-neutral-600 mt-2">Ideas → Decisions → Ready → Projects. Everything connected.</p>
          </div>
          <div className="p-8 space-y-8">
            {/* Pipeline View */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-4">Pipeline</p>
              <div className="space-y-3">
                {/* Idea in Discussion */}
                <button
                  onClick={() => setStep("idea-detail")}
                  className="w-full p-4 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition text-left"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-blue-700 mb-1">💬 IN DISCUSSION</p>
                      <p className="font-medium text-neutral-900">Dark mode for dashboard</p>
                      <p className="text-sm text-neutral-600 mt-1">18 comments • 2 concerns raised • 7 votes</p>
                    </div>
                    <div className="text-right text-xs text-neutral-500">Step 1 of 3</div>
                  </div>
                </button>

                {/* Idea with Decisions */}
                <button
                  onClick={() => setStep("decision-log")}
                  className="w-full p-4 border border-amber-200 bg-amber-50 rounded-lg hover:bg-amber-100 transition text-left"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-amber-700 mb-1">🔍 DECISIONS MADE</p>
                      <p className="font-medium text-neutral-900">API rate limiting strategy</p>
                      <p className="text-sm text-neutral-600 mt-1">Scope: 3 endpoints • Time: 2 weeks • Owner: Alex Chen</p>
                    </div>
                    <div className="text-right text-xs text-neutral-500">Step 2 of 3</div>
                  </div>
                </button>

                {/* Ready with Sign-offs */}
                <button
                  onClick={() => setStep("role-signoff")}
                  className="w-full p-4 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100 transition text-left"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-green-700 mb-1">✓ READY TO BUILD</p>
                      <p className="font-medium text-neutral-900">User notifications system</p>
                      <p className="text-sm text-neutral-600 mt-1">All roles signed off • Scope approved • Ready to convert</p>
                    </div>
                    <div className="text-right text-xs text-neutral-500">Step 3 of 3</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Live Projects */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-4">Executing projects</p>
              <div className="p-4 border border-neutral-200 rounded-lg">
                <p className="text-xs font-mono font-semibold text-neutral-500 mb-2">PERFSINSA</p>
                <p className="font-medium text-neutral-900">Personal Finance SaaS</p>
                <p className="text-sm text-neutral-600 mt-2">45 issues • 8 in progress</p>
              </div>
            </div>
          </div>
        </div>
        <p className="text-sm text-neutral-600 text-center">Click any idea to see how decisions emerge and drive readiness</p>
      </div>
    );
  }

  if (step === "idea-detail") {
    return (
      <div className="mx-auto max-w-5xl">
        <button
          onClick={() => setStep("landing")}
          className="mb-4 text-sm text-neutral-600 hover:text-neutral-900 font-medium"
        >
          ← Back to hub
        </button>
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="bg-neutral-50 border-b border-neutral-200 px-8 py-6">
            <h2 className="text-2xl font-semibold text-neutral-900">Dark mode for dashboard</h2>
            <p className="text-blue-700 font-medium mt-2">💬 In discussion · Step 1 of 3</p>
          </div>
          <div className="p-8 space-y-6">
            <div>
              <p className="font-medium text-neutral-900 mb-2">Description</p>
              <p className="text-neutral-700">Users have requested dark mode to reduce eye strain during evening usage. Need to decide on scope and implementation strategy.</p>
            </div>
            <div className="border-t border-neutral-200 pt-6">
              <p className="font-medium text-neutral-900 mb-4">Discussion & concerns (18 comments)</p>
              <div className="space-y-4">
                <div className="p-4 bg-neutral-50 rounded-lg border-l-2 border-neutral-300">
                  <p className="text-sm font-medium text-neutral-900">Alex Chen</p>
                  <p className="text-sm text-neutral-700 mt-1">Should we support system preferences (respects OS dark mode)?</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg border-l-2 border-amber-300">
                  <p className="text-sm font-medium text-neutral-900">Sarah Kim 🚨</p>
                  <p className="text-sm text-neutral-700 mt-1">CONCERN: Design consistency across all pages. Do we have a dark mode design system?</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border-l-2 border-green-300">
                  <p className="text-sm font-medium text-neutral-900">Alex Chen ✓</p>
                  <p className="text-sm text-neutral-700 mt-1">→ RESOLVED: Sarah will lead design. We'll use Tailwind's dark mode with custom colors.</p>
                </div>
              </div>
            </div>
            <div className="border-t border-neutral-200 pt-6 bg-blue-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-2">What happens next</p>
              <p className="text-sm text-blue-800">Once all concerns are resolved, this moves to "Decisions Made". The team will document scope, timeline, and decisions here.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "decision-log") {
    return (
      <div className="mx-auto max-w-5xl">
        <button
          onClick={() => setStep("landing")}
          className="mb-4 text-sm text-neutral-600 hover:text-neutral-900 font-medium"
        >
          ← Back to hub
        </button>
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="bg-neutral-50 border-b border-neutral-200 px-8 py-6">
            <h2 className="text-2xl font-semibold text-neutral-900">API rate limiting strategy</h2>
            <p className="text-amber-700 font-medium mt-2">🔍 Decisions made · Step 2 of 3</p>
          </div>
          <div className="p-8 space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-900 mb-3">Decision log</p>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">Decision #1: Scope</p>
                  <p className="text-sm text-neutral-700 mt-1">Apply rate limiting to Auth, API, and Webhooks endpoints</p>
                  <p className="text-xs text-neutral-600 mt-2">Decided by: Product team • Concern: "What about internal services?" → Resolved: Internal services are whitelisted</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">Decision #2: Strategy</p>
                  <p className="text-sm text-neutral-700 mt-1">Token bucket algorithm, 1000 req/min per API key</p>
                  <p className="text-xs text-neutral-600 mt-2">Decided by: Engineering • Concern: "Too aggressive?" → Resolved: Can adjust based on metrics</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">Decision #3: Timeline</p>
                  <p className="text-sm text-neutral-700 mt-1">2 weeks (1 week implementation + 1 week testing/monitoring)</p>
                  <p className="text-xs text-neutral-600 mt-2">Decided by: Project lead • Owner: Alex Chen</p>
                </div>
              </div>
            </div>
            <div className="border-t border-neutral-200 pt-6">
              <p className="font-medium text-neutral-900 mb-4">Next step: Role sign-offs</p>
              <p className="text-sm text-neutral-700 mb-4">Once decisions are documented, each role (Design, Product, Engineering) must sign off. This confirms alignment before starting work.</p>
              <button
                onClick={() => setStep("role-signoff")}
                className="w-full bg-amber-600 text-white py-2 rounded-lg hover:bg-amber-700 font-medium text-sm"
              >
                View sign-offs →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "role-signoff") {
    return (
      <div className="mx-auto max-w-5xl">
        <button
          onClick={() => setStep("landing")}
          className="mb-4 text-sm text-neutral-600 hover:text-neutral-900 font-medium"
        >
          ← Back to hub
        </button>
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="bg-neutral-50 border-b border-neutral-200 px-8 py-6">
            <h2 className="text-2xl font-semibold text-neutral-900">User notifications system</h2>
            <p className="text-green-700 font-medium mt-2">✓ Ready to build · Step 3 of 3</p>
          </div>
          <div className="p-8 space-y-6">
            <div>
              <p className="font-medium text-neutral-900 mb-4">Role sign-offs</p>
              <div className="space-y-3">
                <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">🎨 Design</p>
                      <p className="text-xs text-neutral-600 mt-1">Sarah Kim signed off on design mockups</p>
                    </div>
                    <p className="text-xs font-semibold text-green-700">✓ APPROVED</p>
                  </div>
                </div>
                <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">📊 Product</p>
                      <p className="text-xs text-neutral-600 mt-1">Jordan Lee confirmed requirements and priorities</p>
                    </div>
                    <p className="text-xs font-semibold text-green-700">✓ APPROVED</p>
                  </div>
                </div>
                <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">⚙️ Engineering</p>
                      <p className="text-xs text-neutral-600 mt-1">Alex Chen confirmed technical feasibility and timeline</p>
                    </div>
                    <p className="text-xs font-semibold text-green-700">✓ APPROVED</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-neutral-200 pt-6 bg-green-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-green-900 mb-2">All clear to convert</p>
              <p className="text-sm text-green-800">This idea has cleared all gates. Decisions are documented. All roles align. Ready to become a project.</p>
            </div>
            <button
              onClick={() => setStep("landing")}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium"
            >
              Convert to project
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function DesignD() {
  const [step, setStep] = useState<"landing" | "propose" | "discussion" | "ready">("landing");

  if (step === "landing") {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="bg-neutral-50 border-b border-neutral-200 px-8 py-6">
            <h2 className="text-2xl font-semibold text-neutral-900">Forge workflow</h2>
            <p className="text-neutral-600 mt-2">Async consent model: propose, discuss, decide, build.</p>
          </div>
          <div className="p-8 space-y-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-4">Start here</p>
              <button
                onClick={() => setStep("propose")}
                className="w-full p-6 border border-dashed border-neutral-300 rounded-lg hover:border-neutral-400 hover:bg-neutral-50 transition text-center"
              >
                <p className="text-2xl mb-3">💡</p>
                <p className="font-medium text-neutral-900 mb-1">Propose an idea</p>
                <p className="text-sm text-neutral-600">Lightweight, no ceremony. Just the problem and a rough direction.</p>
              </button>
            </div>

            <div className="border-t border-neutral-200 pt-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-4">In workflow</p>
              <div className="space-y-3">
                {/* Idea in discussion */}
                <button
                  onClick={() => setStep("discussion")}
                  className="w-full p-4 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-blue-700 mb-1">💬 DISCUSSING</p>
                      <p className="font-medium text-neutral-900">Dark mode for dashboard</p>
                      <p className="text-sm text-neutral-600 mt-1">Sarah raised a concern • Team responding</p>
                    </div>
                    <div className="text-xs text-neutral-500">8 comments</div>
                  </div>
                </button>

                {/* Idea ready */}
                <div
                  onClick={() => setStep("ready")}
                  className="w-full p-4 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100 transition text-left cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-green-700 mb-1">✓ READY</p>
                      <p className="font-medium text-neutral-900">User notifications system</p>
                      <p className="text-sm text-neutral-600 mt-1">No objections • Team aligned • Ready to convert</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setStep("landing");
                      }}
                      className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700"
                    >
                      Convert
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-4">Executing</p>
              <div className="p-4 border border-neutral-200 rounded-lg">
                <p className="text-xs font-mono font-semibold text-neutral-500 mb-2">PERFSINSA</p>
                <p className="font-medium text-neutral-900">Personal Finance SaaS</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "propose") {
    return (
      <div className="mx-auto max-w-5xl">
        <button
          onClick={() => setStep("landing")}
          className="mb-4 text-sm text-neutral-600 hover:text-neutral-900 font-medium"
        >
          ← Back
        </button>
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="bg-neutral-50 border-b border-neutral-200 px-8 py-6">
            <h2 className="text-2xl font-semibold text-neutral-900">Propose an idea</h2>
            <p className="text-neutral-600 mt-2">Lightweight capture. No forms. Just the core of the idea.</p>
          </div>
          <div className="p-8 space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">What's the idea?</label>
              <input
                type="text"
                placeholder="e.g., Dark mode for the dashboard"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:border-neutral-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Why does this matter?</label>
              <textarea
                placeholder="Problem statement. What pain point does this solve?"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:border-neutral-900 outline-none"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Rough direction (optional)</label>
              <textarea
                placeholder="Early thinking on how to approach this. Not a spec."
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:border-neutral-900 outline-none"
                rows={2}
              />
            </div>
            <button
              onClick={() => setStep("discussion")}
              className="w-full bg-neutral-900 text-white py-2 rounded-lg hover:bg-neutral-800 font-medium"
            >
              Propose
            </button>
            <p className="text-sm text-neutral-500 mt-4">✨ That's it. Your team will see this and start asking clarifying questions. Concerns will surface. When all objections are addressed, it's ready to build.</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === "discussion") {
    return (
      <div className="mx-auto max-w-5xl">
        <button
          onClick={() => setStep("landing")}
          className="mb-4 text-sm text-neutral-600 hover:text-neutral-900 font-medium"
        >
          ← Back
        </button>
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="bg-neutral-50 border-b border-neutral-200 px-8 py-6">
            <h2 className="text-2xl font-semibold text-neutral-900">Dark mode for dashboard</h2>
            <p className="text-blue-700 font-medium mt-2">💬 Discussing · 8 comments · 1 concern</p>
          </div>
          <div className="p-8 space-y-6">
            <div>
              <p className="font-medium text-neutral-900 mb-2">Proposal</p>
              <p className="text-neutral-700">Users have asked for dark mode to reduce eye strain during evening usage. We should support system preferences and allow manual override.</p>
            </div>
            <div className="border-t border-neutral-200 pt-6">
              <p className="font-medium text-neutral-900 mb-4">Discussion (8 comments)</p>
              <div className="space-y-4">
                {/* Clarifying question */}
                <div className="p-4 bg-neutral-50 rounded-lg border-l-2 border-neutral-300">
                  <p className="text-sm font-medium text-neutral-900">Alex Chen</p>
                  <p className="text-sm text-neutral-700 mt-1">Should this work on mobile too, or desktop-first?</p>
                  <p className="text-xs text-neutral-600 mt-2">3 days ago</p>
                </div>

                {/* Response */}
                <div className="p-4 bg-neutral-50 rounded-lg border-l-2 border-neutral-300">
                  <p className="text-sm font-medium text-neutral-900">Jordan Lee</p>
                  <p className="text-sm text-neutral-700 mt-1">→ Both. But we prioritize desktop first since that's where power users spend time.</p>
                  <p className="text-xs text-neutral-600 mt-2">2 days ago</p>
                </div>

                {/* Concern raised */}
                <div className="p-4 bg-red-50 rounded-lg border-l-2 border-red-300">
                  <p className="text-sm font-medium text-neutral-900">Sarah Kim 🚨</p>
                  <p className="text-sm text-neutral-700 mt-1">CONCERN: Do we have a dark mode color system? This needs design system work first.</p>
                  <p className="text-xs text-neutral-600 mt-2">1 day ago</p>
                </div>

                {/* Concern addressed */}
                <div className="p-4 bg-green-50 rounded-lg border-l-2 border-green-300">
                  <p className="text-sm font-medium text-neutral-900">Sarah Kim ✓</p>
                  <p className="text-sm text-neutral-700 mt-1">→ I can build the system as part of this work. 2-week timeline includes design system + implementation.</p>
                  <p className="text-xs text-neutral-600 mt-2">18 hours ago</p>
                </div>

                {/* Team alignment */}
                <div className="p-4 bg-blue-50 rounded-lg border-l-2 border-blue-300">
                  <p className="text-sm font-medium text-neutral-900">Alex Chen ✓</p>
                  <p className="text-sm text-neutral-700 mt-1">Works for me. Let's do this.</p>
                  <p className="text-xs text-neutral-600 mt-2">2 hours ago</p>
                </div>
              </div>
            </div>
            <div className="border-t border-neutral-200 pt-6 bg-green-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-green-900 mb-2">Ready to build?</p>
              <p className="text-sm text-green-800 mb-4">All concerns have been addressed. No objections. Team is aligned.</p>
              <button
                onClick={() => setStep("ready")}
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-medium text-sm"
              >
                Mark as ready
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "ready") {
    return (
      <div className="mx-auto max-w-5xl">
        <button
          onClick={() => setStep("landing")}
          className="mb-4 text-sm text-neutral-600 hover:text-neutral-900 font-medium"
        >
          ← Back
        </button>
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="bg-neutral-50 border-b border-neutral-200 px-8 py-6">
            <h2 className="text-2xl font-semibold text-neutral-900">User notifications system</h2>
            <p className="text-green-700 font-medium mt-2">✓ Ready to convert to project</p>
          </div>
          <div className="p-8 space-y-6">
            <div>
              <p className="font-medium text-neutral-900 mb-3">Why ready?</p>
              <ul className="space-y-2 text-sm text-neutral-700">
                <li>✓ All team questions answered</li>
                <li>✓ No unresolved concerns</li>
                <li>✓ Owner identified (Sarah)</li>
                <li>✓ Timeline agreed (2 weeks)</li>
                <li>✓ Scope is clear (email + in-app + preference center)</li>
              </ul>
            </div>
            <div className="border-t border-neutral-200 pt-6">
              <p className="font-medium text-neutral-900 mb-4">Discussion summary (auto-generated from thread)</p>
              <div className="p-4 bg-neutral-50 rounded-lg text-sm text-neutral-700 space-y-2">
                <p><strong>Decision 1:</strong> Both mobile & desktop, desktop-first. Decided by: Jordan Lee</p>
                <p><strong>Decision 2:</strong> Sarah builds dark mode color system as part of this work. Owner: Sarah Kim</p>
                <p><strong>Concern:</strong> "Design system work required" → Resolved by including it in scope</p>
              </div>
            </div>
            <button
              onClick={() => setStep("landing")}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium"
            >
              Convert to project
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/* ============================================================
   SHARED CHART PRIMITIVES (hand-drawn SVG, no chart lib)
   ============================================================ */

function Sparkline({ data, color = "#16a34a", width = 90, height = 28 }: { data: number[]; color?: string; width?: number; height?: number }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DoraTile({
  label,
  value,
  unit,
  band,
  bandColor,
  trend,
  trendData,
  trendGood,
}: {
  label: string;
  value: string;
  unit?: string;
  band: string;
  bandColor: string;
  trend: string;
  trendData: number[];
  trendGood: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-sm transition">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{label}</p>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${bandColor}`}>{band}</span>
      </div>
      <div className="mt-2 flex items-end justify-between">
        <div>
          <span className="text-2xl font-bold text-neutral-900">{value}</span>
          {unit && <span className="text-sm text-neutral-500 ml-1">{unit}</span>}
        </div>
        <Sparkline data={trendData} color={trendGood ? "#16a34a" : "#dc2626"} />
      </div>
      <p className={`text-xs mt-1.5 font-medium ${trendGood ? "text-green-600" : "text-red-600"}`}>{trend}</p>
    </div>
  );
}

function CycleTimeBar({ phases }: { phases: { name: string; hours: number; color: string; bottleneck?: boolean }[] }) {
  const total = phases.reduce((s, p) => s + p.hours, 0);
  return (
    <div>
      <div className="flex h-10 rounded-lg overflow-hidden">
        {phases.map((p) => (
          <div
            key={p.name}
            className={`relative flex items-center justify-center ${p.color} ${p.bottleneck ? "ring-2 ring-red-500 ring-inset" : ""}`}
            style={{ width: `${(p.hours / total) * 100}%` }}
            title={`${p.name}: ${p.hours}h`}
          >
            {(p.hours / total) > 0.12 && (
              <span className="text-[11px] font-semibold text-white drop-shadow">{p.hours}h</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {phases.map((p) => (
          <div key={p.name} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${p.color}`} />
            <span className={`text-xs ${p.bottleneck ? "font-bold text-red-600" : "text-neutral-600"}`}>
              {p.name} {p.bottleneck && "⚠"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BurnupChart() {
  const w = 520, h = 200, pad = 30;
  const days = 14;
  const scope = [40, 40, 42, 42, 45, 45, 45, 48, 48, 50, 50, 50, 50, 50];
  const done = [0, 4, 9, 13, 16, 19, 24, 27, 30, 33, 36, 38, 41, 43];
  const maxY = 55;
  const x = (i: number) => pad + (i / (days - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / maxY) * (h - pad * 2);
  const scopePts = scope.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const donePts = done.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const projPts = `${x(13)},${y(43)} ${x(15)},${y(50)}`;
  return (
    <svg viewBox={`0 0 ${w} ${h + 14}`} className="w-full">
      {[0, 25, 50].map((v) => (
        <g key={v}>
          <line x1={pad} y1={y(v)} x2={w - pad} y2={y(v)} stroke="#f1f5f9" strokeWidth="1" />
          <text x={pad - 6} y={y(v) + 3} textAnchor="end" className="fill-neutral-400" fontSize="9">{v}</text>
        </g>
      ))}
      <polyline points={scopePts} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 3" />
      <polygon points={`${x(0)},${y(0)} ${donePts} ${x(13)},${y(0)}`} fill="#16a34a" opacity="0.08" />
      <polyline points={donePts} fill="none" stroke="#16a34a" strokeWidth="2.5" />
      <polyline points={projPts} fill="none" stroke="#16a34a" strokeWidth="2" strokeDasharray="2 3" opacity="0.6" />
      <circle cx={x(15)} cy={y(50)} r="3" fill="#16a34a" opacity="0.6" />
      <text x={x(15)} y={y(50) - 8} textAnchor="end" className="fill-green-600" fontSize="9" fontWeight="600">forecast</text>
      <g>
        <line x1={pad} y1={h + 8} x2={pad + 16} y2={h + 8} stroke="#16a34a" strokeWidth="2.5" />
        <text x={pad + 20} y={h + 11} className="fill-neutral-600" fontSize="9">Completed</text>
        <line x1={pad + 90} y1={h + 8} x2={pad + 106} y2={h + 8} stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 3" />
        <text x={pad + 110} y={h + 11} className="fill-neutral-600" fontSize="9">Scope</text>
      </g>
    </svg>
  );
}

function VelocityChart() {
  const sprints = [
    { committed: 32, done: 28 },
    { committed: 35, done: 36 },
    { committed: 38, done: 31 },
    { committed: 34, done: 35 },
    { committed: 40, done: 38 },
    { committed: 42, done: 41 },
  ];
  const w = 520, h = 200, pad = 30;
  const maxY = 50;
  const bw = (w - pad * 2) / sprints.length;
  const y = (v: number) => h - pad - (v / maxY) * (h - pad * 2);
  const avg = sprints.map((_, i) => {
    const slice = sprints.slice(Math.max(0, i - 2), i + 1);
    return slice.reduce((s, d) => s + d.done, 0) / slice.length;
  });
  const avgPts = avg.map((v, i) => `${pad + bw * i + bw / 2},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h + 14}`} className="w-full">
      {[0, 25, 50].map((v) => (
        <line key={v} x1={pad} y1={y(v)} x2={w - pad} y2={y(v)} stroke="#f1f5f9" strokeWidth="1" />
      ))}
      {sprints.map((s, i) => {
        const cx = pad + bw * i + bw * 0.2;
        const barW = bw * 0.28;
        return (
          <g key={i}>
            <rect x={cx} y={y(s.committed)} width={barW} height={h - pad - y(s.committed)} fill="#cbd5e1" rx="2" />
            <rect x={cx + barW + 2} y={y(s.done)} width={barW} height={h - pad - y(s.done)} fill="#6366f1" rx="2" />
            <text x={pad + bw * i + bw / 2} y={h - pad + 12} textAnchor="middle" className="fill-neutral-400" fontSize="9">S{i + 1}</text>
          </g>
        );
      })}
      <polyline points={avgPts} fill="none" stroke="#f59e0b" strokeWidth="2" />
      {avg.map((v, i) => (
        <circle key={i} cx={pad + bw * i + bw / 2} cy={y(v)} r="2.5" fill="#f59e0b" />
      ))}
      <g>
        <rect x={pad} y={h + 4} width={9} height={9} fill="#cbd5e1" rx="1" />
        <text x={pad + 13} y={h + 12} className="fill-neutral-600" fontSize="9">Committed</text>
        <rect x={pad + 75} y={h + 4} width={9} height={9} fill="#6366f1" rx="1" />
        <text x={pad + 88} y={h + 12} className="fill-neutral-600" fontSize="9">Completed</text>
        <line x1={pad + 155} y1={h + 8} x2={pad + 171} y2={h + 8} stroke="#f59e0b" strokeWidth="2" />
        <text x={pad + 175} y={h + 12} className="fill-neutral-600" fontSize="9">3-sprint avg</text>
      </g>
    </svg>
  );
}

function ScatterChart() {
  const w = 520, h = 200, pad = 30;
  const dots = [
    [1, 2], [2, 3], [2, 1], [3, 5], [4, 2], [4, 8], [5, 3], [6, 4], [6, 12], [7, 2],
    [8, 6], [8, 3], [9, 5], [10, 4], [10, 9], [11, 3], [12, 7], [12, 2], [13, 5], [13, 14],
    [14, 4], [15, 6], [16, 3], [16, 11], [17, 5],
  ];
  const maxX = 18, maxY = 16;
  const x = (v: number) => pad + (v / maxX) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / maxY) * (h - pad * 2);
  const p50 = 4, p85 = 9, p95 = 13;
  return (
    <svg viewBox={`0 0 ${w} ${h + 14}`} className="w-full">
      {[
        { v: p50, label: "50%", color: "#16a34a" },
        { v: p85, label: "85%", color: "#f59e0b" },
        { v: p95, label: "95%", color: "#dc2626" },
      ].map((p) => (
        <g key={p.label}>
          <line x1={pad} y1={y(p.v)} x2={w - pad} y2={y(p.v)} stroke={p.color} strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
          <text x={w - pad + 2} y={y(p.v) + 3} className="fill-neutral-500" fontSize="8">{p.label}</text>
          <text x={pad - 4} y={y(p.v) + 3} textAnchor="end" className="fill-neutral-400" fontSize="8">{p.v}d</text>
        </g>
      ))}
      {dots.map(([dx, dy], i) => (
        <circle key={i} cx={x(dx)} cy={y(dy)} r="3.5" fill={dy > p85 ? "#dc2626" : dy > p50 ? "#f59e0b" : "#16a34a"} opacity="0.65" />
      ))}
      <text x={pad} y={h + 11} className="fill-neutral-500" fontSize="9">Completion date →</text>
      <text x={w - pad} y={h + 11} textAnchor="end" className="fill-neutral-500" fontSize="9">85% of issues ship in ≤9 days</text>
    </svg>
  );
}

function DonutChart({ segments }: { segments: { label: string; pct: number; color: string }[] }) {
  const r = 56, c = 2 * Math.PI * r;
  // Precompute each segment's cumulative start offset (no mutation during render).
  const lens = segments.map((s) => (s.pct / 100) * c);
  const arcs = segments.map((s, i) => ({
    ...s,
    len: lens[i],
    offset: lens.slice(0, i).reduce((sum, l) => sum + l, 0),
  }));
  return (
    <div className="flex items-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <g transform="translate(70,70) rotate(-90)">
          {arcs.map((s) => (
            <circle
              key={s.label}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="20"
              strokeDasharray={`${s.len} ${c - s.len}`}
              strokeDashoffset={-s.offset}
            />
          ))}
        </g>
        <text x="70" y="66" textAnchor="middle" className="fill-neutral-900" fontSize="22" fontWeight="700">68%</text>
        <text x="70" y="82" textAnchor="middle" className="fill-neutral-400" fontSize="9">to roadmap</text>
      </svg>
      <div className="space-y-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
            <span className="text-sm text-neutral-700">{s.label}</span>
            <span className="text-sm font-semibold text-neutral-900 ml-auto">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Heatmap() {
  const weeks = 16;
  const levels = ["#f1f5f9", "#bbf7d0", "#86efac", "#4ade80", "#16a34a"];
  const cell = (w: number, d: number) => {
    const seed = (w * 7 + d * 3) % 11;
    if (seed < 2) return 0;
    if (seed < 4) return 1;
    if (seed < 7) return 2;
    if (seed < 9) return 3;
    return 4;
  };
  return (
    <div>
      <div className="flex gap-1">
        {Array.from({ length: weeks }).map((_, w) => (
          <div key={w} className="flex flex-col gap-1">
            {Array.from({ length: 7 }).map((_, d) => (
              <div key={d} className="w-3.5 h-3.5 rounded-sm" style={{ background: levels[cell(w, d)] }} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 mt-2 justify-end">
        <span className="text-[10px] text-neutral-400">Less</span>
        {levels.map((l) => (
          <span key={l} className="w-3 h-3 rounded-sm" style={{ background: l }} />
        ))}
        <span className="text-[10px] text-neutral-400">More</span>
      </div>
    </div>
  );
}

/* ============================================================
   DESIGN E — MISSION CONTROL (personal narrative + intelligence)
   ============================================================ */

function DesignE() {
  const [scope, setScope] = useState<"mine" | "team" | "org">("mine");
  const [drill, setDrill] = useState<null | string>(null);

  const scopeData = {
    mine: {
      narrative: "Welcome back, Matt. Since Friday: 3 of your issues merged, 1 PR is waiting on your review, and FORGE-204 has been blocked for 2 days.",
      dora: [
        { label: "Deploy freq", value: "2.4", unit: "/day", band: "ELITE", bandColor: "bg-green-100 text-green-700", trend: "+18% vs last wk", trendData: [1.8, 2.0, 1.9, 2.2, 2.1, 2.4], trendGood: true },
        { label: "Lead time", value: "8.2", unit: "hrs", band: "ELITE", bandColor: "bg-green-100 text-green-700", trend: "−1.1h faster", trendData: [12, 11, 10, 9.5, 9, 8.2], trendGood: true },
        { label: "Change fail", value: "4.1", unit: "%", band: "ELITE", bandColor: "bg-green-100 text-green-700", trend: "−0.8pts", trendData: [6, 5.5, 5, 4.8, 4.4, 4.1], trendGood: true },
        { label: "Recovery", value: "47", unit: "min", band: "ELITE", bandColor: "bg-green-100 text-green-700", trend: "stable", trendData: [50, 48, 52, 49, 47, 47], trendGood: true },
      ],
      cycle: [
        { name: "Coding", hours: 6, color: "bg-indigo-500" },
        { name: "Pickup", hours: 11, color: "bg-amber-500", bottleneck: true },
        { name: "Review", hours: 4, color: "bg-sky-500" },
        { name: "Deploy", hours: 3, color: "bg-emerald-500" },
      ],
    },
    team: {
      narrative: "Travli Web team: velocity is up 12% this cycle, but pickup time tripled — PRs are sitting ~11h before first review. 2 issues are aging past the 85th percentile.",
      dora: [
        { label: "Deploy freq", value: "9.1", unit: "/day", band: "ELITE", bandColor: "bg-green-100 text-green-700", trend: "+9% vs last wk", trendData: [7, 7.5, 8, 8.4, 8.8, 9.1], trendGood: true },
        { label: "Lead time", value: "1.3", unit: "days", band: "HIGH", bandColor: "bg-sky-100 text-sky-700", trend: "+4h slower", trendData: [0.9, 1.0, 1.1, 1.1, 1.2, 1.3], trendGood: false },
        { label: "Change fail", value: "9.2", unit: "%", band: "HIGH", bandColor: "bg-sky-100 text-sky-700", trend: "+1.4pts", trendData: [6, 6.5, 7, 8, 8.6, 9.2], trendGood: false },
        { label: "Recovery", value: "2.1", unit: "hrs", band: "HIGH", bandColor: "bg-sky-100 text-sky-700", trend: "stable", trendData: [2, 2.2, 2, 2.1, 2, 2.1], trendGood: true },
      ],
      cycle: [
        { name: "Coding", hours: 9, color: "bg-indigo-500" },
        { name: "Pickup", hours: 11, color: "bg-amber-500", bottleneck: true },
        { name: "Review", hours: 7, color: "bg-sky-500" },
        { name: "Deploy", hours: 5, color: "bg-emerald-500" },
      ],
    },
    org: {
      narrative: "Travli org: 4 teams, 31 active issues. 68% of effort is going to roadmap vs 32% keeping-the-lights-on — healthy. One project (Mobile) is forecast to miss its target date.",
      dora: [
        { label: "Deploy freq", value: "21", unit: "/day", band: "ELITE", bandColor: "bg-green-100 text-green-700", trend: "+6%", trendData: [16, 17, 18, 19, 20, 21], trendGood: true },
        { label: "Lead time", value: "1.6", unit: "days", band: "HIGH", bandColor: "bg-sky-100 text-sky-700", trend: "stable", trendData: [1.5, 1.6, 1.5, 1.6, 1.6, 1.6], trendGood: true },
        { label: "Change fail", value: "7.8", unit: "%", band: "HIGH", bandColor: "bg-sky-100 text-sky-700", trend: "−0.5pts", trendData: [9, 8.6, 8.3, 8, 7.9, 7.8], trendGood: true },
        { label: "Recovery", value: "1.8", unit: "hrs", band: "HIGH", bandColor: "bg-sky-100 text-sky-700", trend: "−12min", trendData: [2.4, 2.2, 2, 1.9, 1.85, 1.8], trendGood: true },
      ],
      cycle: [
        { name: "Coding", hours: 11, color: "bg-indigo-500" },
        { name: "Pickup", hours: 9, color: "bg-amber-500" },
        { name: "Review", hours: 8, color: "bg-sky-500", bottleneck: true },
        { name: "Deploy", hours: 6, color: "bg-emerald-500" },
      ],
    },
  }[scope];

  const attention = [
    { tag: "REVIEW", tagColor: "bg-purple-100 text-purple-700", title: "Add Stripe webhook retry handler", meta: "Sarah requested your review · PR open 14h", urgent: true },
    { tag: "BLOCKED", tagColor: "bg-red-100 text-red-700", title: "FORGE-204 · Migrate rate limiter to Redis", meta: "Blocked 2 days · waiting on infra access", urgent: true },
    { tag: "OVERDUE", tagColor: "bg-orange-100 text-orange-700", title: "FORGE-188 · Tenant export job", meta: "Due yesterday · in progress", urgent: false },
    { tag: "MENTION", tagColor: "bg-sky-100 text-sky-700", title: "Jordan mentioned you on 'Dark mode scope'", meta: "2h ago · Think Tank", urgent: false },
    { tag: "ASSIGNED", tagColor: "bg-neutral-100 text-neutral-700", title: "FORGE-211 · Fix flaky isolation test", meta: "Moved to your queue this morning", urgent: false },
  ];

  if (drill) {
    return (
      <div className="mx-auto max-w-6xl">
        <button onClick={() => setDrill(null)} className="mb-4 text-sm text-neutral-600 hover:text-neutral-900 font-medium">← Back to Mission Control</button>
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="bg-neutral-50 border-b border-neutral-200 px-8 py-6">
            <h2 className="text-2xl font-semibold text-neutral-900">{drill}</h2>
            <p className="text-neutral-600 mt-1">Drill-down detail (prototype) — this is where the metric expands to issue-level breakdown.</p>
          </div>
          <div className="p-8">
            <p className="text-sm text-neutral-600">In the real product, clicking a metric opens the underlying issues, PRs, and the AI explanation of <em>why</em> the number moved. This proves the click-through path works.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Mission Control</h2>
          <p className="text-sm text-neutral-500">Travli workspace · Friday, June 16</p>
        </div>
        <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-1">
          {(["mine", "team", "org"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition ${
                scope === s ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {s === "mine" ? "Mine" : s === "team" ? "My Team" : "Org"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 flex gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">✦</div>
        <div>
          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">What changed since you were gone</p>
          <p className="text-sm text-neutral-800">{scopeData.narrative}</p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-center gap-4">
        <div className="text-2xl">⚠️</div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900">Sprint 6 is at risk</p>
          <p className="text-sm text-amber-800">Monte Carlo forecast: <strong>62% confident</strong> you'll finish by Fri Jun 20. Pickup time spiked 3× this week — 4 PRs waiting on review are the main drag.</p>
        </div>
        <button onClick={() => setDrill("Sprint 6 risk forecast")} className="px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 whitespace-nowrap">See why →</button>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">DORA · the four keys (incumbents bury these)</p>
        <div className="grid grid-cols-4 gap-3">
          {scopeData.dora.map((d) => (
            <button key={d.label} onClick={() => setDrill(`${d.label} breakdown`)} className="text-left">
              <DoraTile {...d} />
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 bg-white rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-neutral-900">Cycle time breakdown</h3>
            <span className="text-xs text-neutral-500">commit → production</span>
          </div>
          <p className="text-sm text-neutral-500 mb-4">The phase view Jira &amp; Linear can't show — it needs Git data fused with issues.</p>
          <CycleTimeBar phases={scopeData.cycle} />
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm text-amber-800"><strong>Bottleneck:</strong> Pickup time (PR open → first review) is your biggest drag. Auto-assign reviewers to cut it.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-neutral-900">Needs you</h3>
            <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">2 urgent</span>
          </div>
          <div className="space-y-2.5">
            {attention.map((a) => (
              <button
                key={a.title}
                onClick={() => setDrill(a.title)}
                className={`w-full text-left p-2.5 rounded-lg border transition hover:shadow-sm ${a.urgent ? "border-neutral-200 bg-white" : "border-neutral-100 bg-neutral-50"}`}
              >
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${a.tagColor}`}>{a.tag}</span>
                <p className="text-sm font-medium text-neutral-900 mt-1.5 leading-snug">{a.title}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{a.meta}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="text-sm text-neutral-500 text-center">Toggle Mine / My Team / Org · click any tile or attention item to drill in</p>
    </div>
  );
}

/* ============================================================
   DESIGN F — DELIVERY INTELLIGENCE (forecast + investment)
   ============================================================ */

function DesignF() {
  const [tab, setTab] = useState<"forecast" | "flow" | "investment">("forecast");

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Delivery Intelligence</h2>
          <p className="text-sm text-neutral-500">Travli org · 4 teams · 31 active issues</p>
        </div>
        <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-1">
          {([
            { id: "forecast", label: "Forecast" },
            { id: "flow", label: "Flow & Speed" },
            { id: "investment", label: "Investment" },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                tab === t.id ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Throughput</p>
          <p className="text-2xl font-bold text-neutral-900 mt-1">41 <span className="text-sm font-normal text-neutral-500">issues/cycle</span></p>
          <p className="text-xs text-green-600 font-medium mt-1">+12% vs last cycle</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Flow efficiency</p>
          <p className="text-2xl font-bold text-neutral-900 mt-1">38<span className="text-sm font-normal text-neutral-500">%</span></p>
          <p className="text-xs text-amber-600 font-medium mt-1">62% of time is waiting</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">WIP</p>
          <p className="text-2xl font-bold text-neutral-900 mt-1">17 <span className="text-sm font-normal text-neutral-500">in flight</span></p>
          <p className="text-xs text-red-600 font-medium mt-1">Above limit (12) — overloaded</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Predictability</p>
          <p className="text-2xl font-bold text-neutral-900 mt-1">86<span className="text-sm font-normal text-neutral-500">%</span></p>
          <p className="text-xs text-green-600 font-medium mt-1">committed vs delivered</p>
        </div>
      </div>

      {tab === "forecast" && (
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h3 className="font-semibold text-neutral-900 mb-1">Burnup — Sprint 6</h3>
            <p className="text-sm text-neutral-500 mb-3">Scope line exposes creep; projection shows the finish.</p>
            <BurnupChart />
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h3 className="font-semibold text-neutral-900 mb-1">Velocity &amp; commitment</h3>
            <p className="text-sm text-neutral-500 mb-3">Committed vs completed with 3-sprint rolling average.</p>
            <VelocityChart />
          </div>
          <div className="col-span-2 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-5 flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">✦</div>
            <div>
              <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">Monte Carlo forecast</p>
              <p className="text-sm text-neutral-800">Based on the last 6 sprints of throughput, there's an <strong>85% chance</strong> the remaining 7 issues ship by <strong>Wed Jun 18</strong>, and a <strong>98% chance</strong> by <strong>Fri Jun 20</strong>. Two issues are the long pole — both blocked on review.</p>
            </div>
          </div>
        </div>
      )}

      {tab === "flow" && (
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h3 className="font-semibold text-neutral-900 mb-1">Cycle time scatter</h3>
            <p className="text-sm text-neutral-500 mb-3">Each dot = a shipped issue. Percentile lines give commitment-grade forecasts.</p>
            <ScatterChart />
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h3 className="font-semibold text-neutral-900 mb-1">Team cycle time by phase</h3>
            <p className="text-sm text-neutral-500 mb-4">Where time actually goes across the org.</p>
            <CycleTimeBar phases={[
              { name: "Coding", hours: 11, color: "bg-indigo-500" },
              { name: "Pickup", hours: 9, color: "bg-amber-500" },
              { name: "Review", hours: 8, color: "bg-sky-500", bottleneck: true },
              { name: "Deploy", hours: 6, color: "bg-emerald-500" },
            ]} />
            <div className="mt-6">
              <h3 className="font-semibold text-neutral-900 mb-3">Contribution activity</h3>
              <Heatmap />
            </div>
          </div>
        </div>
      )}

      {tab === "investment" && (
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h3 className="font-semibold text-neutral-900 mb-1">Investment allocation</h3>
            <p className="text-sm text-neutral-500 mb-4">Where engineering effort actually goes — the metric that speaks to the business.</p>
            <DonutChart segments={[
              { label: "Roadmap (new features)", pct: 68, color: "#6366f1" },
              { label: "Keep-the-lights-on", pct: 16, color: "#94a3b8" },
              { label: "Tech debt", pct: 11, color: "#f59e0b" },
              { label: "Customer / support", pct: 5, color: "#16a34a" },
            ]} />
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h3 className="font-semibold text-neutral-900 mb-3">Per-team breakdown</h3>
            <div className="space-y-4">
              {[
                { team: "Web", roadmap: 74, ktlo: 12, debt: 10, cust: 4 },
                { team: "Mobile", roadmap: 55, ktlo: 25, debt: 15, cust: 5 },
                { team: "Platform", roadmap: 48, ktlo: 22, debt: 24, cust: 6 },
                { team: "Growth", roadmap: 82, ktlo: 8, debt: 6, cust: 4 },
              ].map((t) => (
                <div key={t.team}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-neutral-800">{t.team}</span>
                    <span className="text-neutral-500">{t.roadmap}% roadmap</span>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden">
                    <div className="bg-indigo-500" style={{ width: `${t.roadmap}%` }} />
                    <div className="bg-neutral-400" style={{ width: `${t.ktlo}%` }} />
                    <div className="bg-amber-500" style={{ width: `${t.debt}%` }} />
                    <div className="bg-green-500" style={{ width: `${t.cust}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-sm text-amber-800"><strong>Flag:</strong> Platform is spending 24% on tech debt — 2× the org average. Worth a conversation before it compounds.</p>
            </div>
          </div>
        </div>
      )}

      <p className="text-sm text-neutral-500 text-center">Switch tabs: Forecast · Flow &amp; Speed · Investment</p>
    </div>
  );
}

/* ============================================================
   DESIGN G — PROJECT PORTAL (the single-project "where are we" home)
   ============================================================ */

function StatusBattery({ segments }: { segments: { label: string; count: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.count, 0) || 1;
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-neutral-100">
        {segments.map((s) => (
          <div key={s.label} className={s.color} style={{ width: `${(s.count / total) * 100}%` }} title={`${s.label}: ${s.count}`} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${s.color}`} />
            <span className="text-xs text-neutral-600">{s.label} <span className="font-semibold text-neutral-900">{s.count}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DesignG() {
  const [mode, setMode] = useState<"active" | "new">("active");
  const [tab, setTab] = useState<"overview" | "board" | "timeline" | "costs">("overview");
  const isNew = mode === "new";

  const battery = [
    { label: "Backlog", count: 14, color: "bg-neutral-300" },
    { label: "Todo", count: 8, color: "bg-sky-400" },
    { label: "In progress", count: 5, color: "bg-indigo-500" },
    { label: "In review", count: 2, color: "bg-amber-400" },
    { label: "Done", count: 18, color: "bg-emerald-500" },
  ];
  const total = battery.reduce((s, x) => s + x.count, 0);
  const done = battery.find((b) => b.label === "Done")!.count;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Mode toggle (prototype only) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <span className="hover:text-neutral-600">Projects</span>
          <span>/</span>
          <span className="font-mono text-neutral-500">PER</span>
        </div>
        <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-1">
          {(["active", "new"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition ${
                mode === m ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {m === "active" ? "Active project" : "New project"}
            </button>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs font-semibold text-neutral-600">PER</span>
            {isNew ? (
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-500">Not started</span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">● At risk</span>
            )}
            {isNew ? (
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-500">Set a go-live date</span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Go-live in 42d</span>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">Personal Finance SaaS App</h1>
          <p className="mt-1 text-sm text-neutral-500">Owner: Matt Giblin · 4 members</p>
        </div>
        <button className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">Open board →</button>
      </div>

      {/* Tab bar — the project's work surfaces */}
      <div className="flex gap-1 border-b border-neutral-200">
        {([
          { id: "overview", label: "Overview" },
          { id: "board", label: "Board" },
          { id: "timeline", label: "Timeline" },
          { id: "costs", label: "Costs" },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (isNew ? (
        /* ---------- NEW PROJECT: guided setup, no dead zeros ---------- */
        <>
          <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-5">
            <p className="text-sm font-semibold text-indigo-800">Let&rsquo;s set this project up</p>
            <p className="mt-1 text-sm text-neutral-600">A few steps to get from idea to in-flight. Each one unlocks the live dashboard.</p>
            <div className="mt-4 space-y-2">
              {[
                { done: true, label: "Linked from Think Tank decision", sub: "Origin + decisions carried over automatically" },
                { done: false, label: "Add the first issue", sub: "Break the work into trackable pieces" },
                { done: false, label: "Set a go-live date", sub: "Drives the countdown + burnup projection" },
                { done: false, label: "Post the first status update", sub: "Sets the health and tells the team where we are" },
                { done: false, label: "Invite the team", sub: "Assign a lead and contributors" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${s.done ? "bg-emerald-500 text-white" : "border border-neutral-300 text-neutral-400"}`}>
                    {s.done ? "✓" : "+"}
                  </span>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${s.done ? "text-neutral-400 line-through" : "text-neutral-900"}`}>{s.label}</p>
                    <p className="text-xs text-neutral-500">{s.sub}</p>
                  </div>
                  {!s.done && <button className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-800">Do it</button>}
                </div>
              ))}
            </div>
          </div>
          <ProvenancePanel />
        </>
      ) : (
        /* ---------- ACTIVE PROJECT: the live portal ---------- */
        <>
          {/* What needs attention — explainable risk */}
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">This project needs attention</p>
              <p className="text-sm text-amber-800">3 issues overdue · 38% done with go-live 42 days out (behind pace) · no status update in 9 days. Forecast: <strong>~8 days late</strong> at current velocity.</p>
            </div>
            <button className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700">Post update</button>
          </div>

          <div className="grid grid-cols-3 gap-5">
            {/* Left column */}
            <div className="col-span-2 space-y-5">
              {/* Latest status update (pinned) */}
              <div className="rounded-xl border border-neutral-200 bg-white p-5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-neutral-900">Latest update</h3>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">AT RISK</span>
                  </div>
                  <button className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100">✦ Draft with AI</button>
                </div>
                <p className="text-sm text-neutral-700">
                  <strong>TL;DR:</strong> Core ledger + auth shipped; budgeting module is the long pole. Review queue is backing up — 2 PRs waiting. We&rsquo;ll likely slip ~1 week unless we pull in a reviewer.
                </p>
                <p className="mt-2 text-xs text-neutral-400">Matt Giblin · 9 days ago</p>
              </div>

              {/* Progress battery */}
              <div className="rounded-xl border border-neutral-200 bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-neutral-900">Progress</h3>
                  <span className="text-sm text-neutral-500"><strong className="text-neutral-900">{done}</strong> of {total} done · {pct}%</span>
                </div>
                <StatusBattery segments={battery} />
              </div>

              {/* Burnup */}
              <div className="rounded-xl border border-neutral-200 bg-white p-5">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="font-semibold text-neutral-900">Burnup to go-live</h3>
                  <span className="text-xs text-neutral-500">scope vs completed · projection</span>
                </div>
                <p className="mb-3 text-sm text-neutral-500">Dotted line projects completion from current velocity; it lands past the target — hence &ldquo;at risk.&rdquo;</p>
                <BurnupChart />
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-5">
              {/* Go-live countdown + track */}
              <div className="rounded-xl border border-neutral-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Go-live</p>
                <p className="mt-1 text-3xl font-bold text-neutral-900">42 <span className="text-base font-normal text-neutral-500">days</span></p>
                <div className="mt-4 h-1.5 rounded-full bg-neutral-100">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: "55%" }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-neutral-400">
                  <span>May 1 · start</span>
                  <span>Aug 28 · go-live</span>
                </div>
              </div>

              {/* Team */}
              <div className="rounded-xl border border-neutral-200 bg-white p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Team</p>
                <div className="space-y-2.5">
                  {[
                    { n: "Matt Giblin", r: "Lead" },
                    { n: "Sarah Kim", r: "Design" },
                    { n: "Alex Chen", r: "Engineering" },
                    { n: "Jordan Lee", r: "Product" },
                  ].map((p) => (
                    <div key={p.n} className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-600">{p.n.split(" ").map((x) => x[0]).join("")}</span>
                      <span className="text-sm text-neutral-700">{p.n}</span>
                      <span className="ml-auto text-xs text-neutral-400">{p.r}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <ProvenancePanel />

          {/* Project brief */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">Project brief</h3>
              <button className="text-xs font-medium text-neutral-500 hover:text-neutral-900">Edit</button>
            </div>
            <p className="text-sm text-neutral-600 leading-relaxed">
              A personal-finance companion: connect accounts, auto-categorize spend, and surface a weekly money story. v1 scope is ledger + budgeting + insights; bank sync is fast-follow. Success = a user can see &ldquo;where did my money go&rdquo; in under 10 seconds.
            </p>
          </div>

          {/* Recent activity */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Recent activity</p>
            <div className="space-y-2.5 text-sm">
              {[
                { who: "Alex Chen", what: "moved PER-31 to In review", when: "2h ago" },
                { who: "Sarah Kim", what: "completed PER-28 · Budget category chips", when: "5h ago" },
                { who: "Jordan Lee", what: "commented on PER-33", when: "yesterday" },
                { who: "Matt Giblin", what: "created PER-34 · Weekly money story email", when: "2d ago" },
              ].map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-neutral-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
                  <span><strong className="text-neutral-800">{a.who}</strong> {a.what}</span>
                  <span className="ml-auto text-xs text-neutral-400">{a.when}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ))}

      {tab === "board" && <BoardTab />}
      {tab === "timeline" && <TimelineTab />}
      {tab === "costs" && <CostsTab />}

      <p className="text-center text-sm text-neutral-500">
        Tabs are the project&rsquo;s work surfaces: <strong>Overview</strong> (status) · <strong>Board</strong> (do the work) · <strong>Timeline</strong> (schedule) · <strong>Costs</strong> (budget). Active/New toggle affects Overview.
      </p>
    </div>
  );
}

/* The differentiator: why this project exists — origin, decisions, sign-offs,
   carried forward from Think Tank onto the project home. */
function ProvenancePanel() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="font-semibold text-neutral-900">Why this project exists</h3>
        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">PROVENANCE</span>
      </div>
      <p className="mb-4 text-sm text-neutral-500">The origin, decisions, and sign-offs that led here — carried from Think Tank so the &ldquo;why&rdquo; never gets lost.</p>

      <div className="grid grid-cols-3 gap-4">
        {/* Origin */}
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Origin</p>
          <p className="mt-2 text-sm font-medium text-neutral-900">💡 Personal finance for real people</p>
          <p className="mt-1 text-xs text-neutral-500">Raised by Jordan Lee · discussed 3 weeks · converted Jun 2</p>
          <button className="mt-2 text-xs font-medium text-indigo-600 hover:underline">View in Think Tank →</button>
        </div>

        {/* Decisions */}
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Decisions</p>
          <ul className="mt-2 space-y-2">
            <li className="text-sm text-neutral-700">✅ <strong>Scope v1 to ledger + budgeting</strong><span className="block text-xs text-neutral-500">bank sync deferred — too much compliance for v1</span></li>
            <li className="text-sm text-neutral-700">✅ <strong>Estimated costs, not live booking</strong><span className="block text-xs text-neutral-500">matches the AI-planner model</span></li>
          </ul>
        </div>

        {/* Sign-offs */}
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Sign-offs</p>
          <div className="mt-2 space-y-1.5">
            {[
              { r: "🎨 Design", who: "Sarah Kim" },
              { r: "📊 Product", who: "Jordan Lee" },
              { r: "⚙️ Engineering", who: "Alex Chen" },
            ].map((s) => (
              <div key={s.r} className="flex items-center justify-between text-sm">
                <span className="text-neutral-700">{s.r}</span>
                <span className="text-xs font-semibold text-green-700">✓ {s.who}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Board tab — the work surface that already exists in Forge today. */
function BoardTab() {
  const cols = [
    { name: "Backlog", color: "bg-neutral-300", cards: ["PER-40 · Recurring transactions", "PER-41 · CSV import"] },
    { name: "Todo", color: "bg-sky-400", cards: ["PER-35 · Budget alerts", "PER-36 · Category rules"] },
    { name: "In progress", color: "bg-indigo-500", cards: ["PER-31 · Spending insights", "PER-33 · Net-worth tile"] },
    { name: "In review", color: "bg-amber-400", cards: ["PER-29 · Ledger pagination"] },
    { name: "Done", color: "bg-emerald-500", cards: ["PER-28 · Category chips", "PER-22 · Auth"] },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
        <strong className="text-neutral-900">This is where you do the work.</strong> Create issues, assign them, and drag cards across columns as you build. This board already exists in Forge — the Overview tab is just the live rollup of what happens here.
      </div>
      <div className="grid grid-cols-5 gap-3">
        {cols.map((c) => (
          <div key={c.name} className="rounded-xl border border-neutral-200 bg-white p-3">
            <div className="mb-3 flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-sm ${c.color}`} />
              <span className="text-xs font-semibold text-neutral-700">{c.name}</span>
              <span className="ml-auto text-xs text-neutral-400">{c.cards.length}</span>
            </div>
            <div className="space-y-2">
              {c.cards.map((t) => (
                <div key={t} className="rounded-lg border border-neutral-200 bg-white p-2.5 text-xs text-neutral-700 shadow-sm">{t}</div>
              ))}
              <button className="w-full rounded-lg border border-dashed border-neutral-300 py-1.5 text-xs text-neutral-400 hover:text-neutral-600">+ Add</button>
            </div>
          </div>
        ))}
      </div>
      <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">Open full board →</button>
    </div>
  );
}

/* Timeline tab — lightweight: issues on a track by start/due, color by status. */
function TimelineTab() {
  const weeks = ["May 1", "", "May 15", "", "Jun 1", "", "Jun 15", "", "Jul 1", ""];
  const todayPct = 42;
  const goLivePct = 86;
  const rows = [
    { ref: "PER-22 · Auth", start: 0, end: 18, color: "bg-emerald-500" },
    { ref: "PER-28 · Category chips", start: 8, end: 30, color: "bg-emerald-500" },
    { ref: "PER-31 · Spending insights", start: 24, end: 52, color: "bg-indigo-500" },
    { ref: "PER-33 · Net-worth tile", start: 30, end: 58, color: "bg-indigo-500" },
    { ref: "PER-29 · Ledger pagination", start: 38, end: 50, color: "bg-amber-400" },
    { ref: "PER-35 · Budget alerts", start: 52, end: 74, color: "bg-sky-400" },
    { ref: "PER-40 · Recurring txns", start: 64, end: 86, color: "bg-neutral-300" },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
        <strong className="text-neutral-900">Lightweight timeline.</strong> Each bar is an issue on a track by its start/due date, colored by status. No dependency arrows or critical paths — just &ldquo;what&rsquo;s happening when,&rdquo; the way a small team actually needs it. <span className="text-neutral-400">(Requires adding start/due dates to issues.)</span>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        {/* Week axis */}
        <div className="ml-44 flex text-[11px] text-neutral-400">
          {weeks.map((w, i) => (
            <div key={i} className="flex-1">{w}</div>
          ))}
        </div>
        {/* Rows */}
        <div className="relative mt-2">
          {/* today + go-live verticals */}
          <div className="pointer-events-none absolute inset-y-0 left-44 right-0">
            <div className="absolute inset-y-0 w-px bg-indigo-400" style={{ left: `${todayPct}%` }} />
            <div className="absolute -top-4 text-[10px] font-medium text-indigo-500" style={{ left: `${todayPct}%` }}>today</div>
            <div className="absolute inset-y-0 w-px bg-red-400" style={{ left: `${goLivePct}%` }} />
            <div className="absolute -top-4 -translate-x-full text-[10px] font-medium text-red-500" style={{ left: `${goLivePct}%` }}>go-live</div>
          </div>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.ref} className="flex items-center">
                <div className="w-44 shrink-0 truncate pr-3 text-xs text-neutral-600">{r.ref}</div>
                <div className="relative h-6 flex-1 rounded bg-neutral-50">
                  <div
                    className={`absolute top-1 h-4 rounded ${r.color}`}
                    style={{ left: `${r.start}%`, width: `${r.end - r.start}%` }}
                    title={r.ref}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* legend */}
        <div className="ml-44 mt-4 flex flex-wrap gap-x-4 gap-y-1">
          {[
            { l: "Backlog", c: "bg-neutral-300" },
            { l: "Todo", c: "bg-sky-400" },
            { l: "In progress", c: "bg-indigo-500" },
            { l: "In review", c: "bg-amber-400" },
            { l: "Done", c: "bg-emerald-500" },
          ].map((x) => (
            <div key={x.l} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${x.c}`} />
              <span className="text-xs text-neutral-600">{x.l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Costs tab — simple budget + spend with a burn bar. */
function CostsTab() {
  const budget = 48000;
  const spent = 31200;
  const remaining = budget - spent;
  const pct = Math.round((spent / budget) * 100);
  const fmt = (n: number) => `$${n.toLocaleString()}`;
  const entries = [
    { date: "Jun 12", item: "Plaid sandbox → production", cat: "Vendor / API", amt: 1800 },
    { date: "Jun 8", item: "Contract designer — budgeting flows", cat: "Contractor", amt: 6500 },
    { date: "May 30", item: "Supabase Pro (3 mo)", cat: "Infrastructure", amt: 75 },
    { date: "May 18", item: "Logo + brand pass", cat: "Design", amt: 2200 },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
        <strong className="text-neutral-900">Simple budget &amp; spend.</strong> Set a project budget, log spend as it happens, and watch the burn. No time-tracking required — just &ldquo;are we within budget for go-live?&rdquo;
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Budget</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{fmt(budget)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Spent</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{fmt(spent)}</p>
          <p className="text-xs text-amber-600">{pct}% of budget</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Remaining</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{fmt(remaining)}</p>
        </div>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-neutral-700">Burn</span>
          <span className="text-neutral-500">{fmt(spent)} / {fmt(budget)}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-neutral-100">
          <div className={`h-full ${pct > 90 ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-neutral-900">Spend</h3>
          <button className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800">+ Add spend</button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
              <th className="pb-2 font-medium">Date</th>
              <th className="pb-2 font-medium">Item</th>
              <th className="pb-2 font-medium">Category</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.item} className="border-t border-neutral-100">
                <td className="py-2 text-neutral-500">{e.date}</td>
                <td className="py-2 text-neutral-800">{e.item}</td>
                <td className="py-2 text-neutral-500">{e.cat}</td>
                <td className="py-2 text-right font-medium text-neutral-900">{fmt(e.amt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
