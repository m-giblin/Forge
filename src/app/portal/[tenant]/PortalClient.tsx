"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { submitFeedbackAction } from "../../feedback/[tenant]/actions";

type Tab = "submit" | "status" | "changelog";

type ChangelogItem = {
  id: string;
  number: number;
  title: string;
  type: string;
  updated_at: string;
  projectKey: string;
};

type Ticket = {
  id: string;
  title: string;
  status: string;
  type: string;
  created_at: string;
  updated_at: string;
} | null;

const TYPE_COLORS: Record<string, string> = {
  bug: "bg-red-100 text-red-700",
  feature: "bg-indigo-100 text-indigo-700",
  question: "bg-amber-100 text-amber-700",
  other: "bg-neutral-100 text-neutral-600",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-neutral-100 text-neutral-500",
};

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PortalClient({
  slug,
  tenantName,
  changelog,
  initialTicket,
  initialTab,
}: {
  slug: string;
  tenantName: string;
  changelog: ChangelogItem[];
  initialTicket: Ticket;
  initialTab: Tab;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(initialTab);

  // Submit form state
  const [type, setType] = useState("bug");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  // Status lookup state
  const [lookupRef, setLookupRef] = useState(searchParams.get("ref") ?? "");
  const [lookupEmail, setLookupEmail] = useState(searchParams.get("email") ?? "");
  const [ticket, setTicket] = useState<Ticket>(initialTicket);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLooking, startLookup] = useTransition();

  useEffect(() => {
    if (initialTicket) setTab("status");
  }, [initialTicket]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    startSubmit(async () => {
      const res = await submitFeedbackAction(slug, { name, email, type, title, body });
      if (res.ok) {
        setSubmitSuccess("Thanks! Your feedback has been received. We'll follow up at your email address.");
        setName(""); setEmail(""); setTitle(""); setBody("");
      } else {
        setSubmitError(res.error ?? "Something went wrong.");
      }
    });
  }

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupError(null);
    startLookup(async () => {
      const params = new URLSearchParams({ ref: lookupRef.trim(), email: lookupEmail.trim(), tab: "status" });
      router.push(`/portal/${slug}?${params}`);
    });
  }

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "submit", label: "Submit Request", icon: "✉️" },
    { id: "status", label: "Check Status", icon: "🔍" },
    { id: "changelog", label: "What's New", icon: "📋" },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-3xl px-6 py-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-0.5">Support Portal</p>
            <h1 className="text-xl font-bold text-neutral-900">{tenantName}</h1>
          </div>
          <div className="text-2xl">🛠️</div>
        </div>
        {/* Tabs */}
        <div className="mx-auto max-w-3xl px-6">
          <div className="flex gap-1 border-b border-transparent -mb-px">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8">
        {/* Submit tab */}
        {tab === "submit" && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
            {submitSuccess ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">✅</div>
                <h2 className="text-lg font-semibold text-neutral-900 mb-1">Request received</h2>
                <p className="text-sm text-neutral-500 mb-4">{submitSuccess}</p>
                <button onClick={() => setSubmitSuccess(null)} className="text-sm text-indigo-600 hover:underline">
                  Submit another
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-neutral-900 mb-1">Submit a support request</h2>
                  <p className="text-sm text-neutral-500">We typically respond within 1 business day.</p>
                </div>
                {submitError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{submitError}</div>
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Your name</label>
                    <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith"
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Email address</label>
                    <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com"
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Type</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {["bug", "feature", "question", "other"].map((t) => (
                      <button key={t} type="button" onClick={() => setType(t)}
                        className={`rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-colors ${
                          type === t ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                        }`}>
                        {t === "bug" ? "🐛 Bug" : t === "feature" ? "✨ Feature" : t === "question" ? "❓ Question" : "💬 Other"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Subject</label>
                  <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief description of the issue"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Details</label>
                  <textarea required rows={5} value={body} onChange={(e) => setBody(e.target.value)}
                    placeholder="Please describe the problem or request in as much detail as possible…"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 resize-none" />
                </div>
                <button type="submit" disabled={isSubmitting}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {isSubmitting ? "Sending…" : "Send request"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Status tab */}
        {tab === "status" && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-neutral-900 mb-1">Check ticket status</h2>
              <p className="text-sm text-neutral-500 mb-4">Enter your ticket ID and the email you submitted with.</p>
              <form onSubmit={handleLookup} className="space-y-4">
                {lookupError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{lookupError}</div>
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Ticket ID</label>
                    <input required value={lookupRef} onChange={(e) => setLookupRef(e.target.value)} placeholder="xxxxxxxx-xxxx-..."
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Your email</label>
                    <input required type="email" value={lookupEmail} onChange={(e) => setLookupEmail(e.target.value)} placeholder="jane@example.com"
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
                  </div>
                </div>
                <button type="submit" disabled={isLooking}
                  className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50 transition-colors">
                  {isLooking ? "Looking up…" : "Look up ticket"}
                </button>
              </form>
            </div>

            {ticket && (
              <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-neutral-900">{ticket.title}</h3>
                    <p className="text-xs text-neutral-400 mt-0.5">Submitted {timeAgo(ticket.created_at)} · Last updated {timeAgo(ticket.updated_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${TYPE_COLORS[ticket.type] ?? "bg-neutral-100 text-neutral-600"}`}>
                      {ticket.type}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[ticket.status] ?? "bg-neutral-100 text-neutral-500"}`}>
                      {ticket.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {ticket === null && searchParams.get("ref") && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                No ticket found for that ID and email combination. Check that both match exactly.
              </div>
            )}
          </div>
        )}

        {/* Changelog tab */}
        {tab === "changelog" && (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-neutral-100">
              <h2 className="text-base font-semibold text-neutral-900">What&apos;s new</h2>
              <p className="text-sm text-neutral-500 mt-0.5">Recent updates shipped by {tenantName}</p>
            </div>
            {changelog.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-neutral-400">No updates yet.</div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {changelog.map((item) => (
                  <li key={item.id} className="px-6 py-4 flex items-start gap-4">
                    <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${TYPE_COLORS[item.type] ?? "bg-neutral-100 text-neutral-600"}`}>
                      {item.type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800 truncate">{item.title}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{item.projectKey}-{item.number} · {timeAgo(item.updated_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="text-center py-6 text-xs text-neutral-400">
        Powered by <Link href="/" className="underline hover:text-neutral-600">Forge</Link>
      </div>
    </div>
  );
}
