"use client";

import { useState, useTransition } from "react";
import { submitFeedbackAction } from "./actions";

const TYPES = [
  { value: "bug", label: "🐛 Bug report", description: "Something isn't working" },
  { value: "feature", label: "✨ Feature request", description: "Suggest an improvement" },
  { value: "question", label: "❓ Question", description: "Need some help" },
  { value: "other", label: "💬 Other", description: "Something else" },
];

interface Props {
  slug: string;
  tenantName: string;
}

export default function FeedbackForm({ slug }: Props) {
  const [type, setType] = useState("bug");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitFeedbackAction(slug, { name, email, type, title, body });
      if (result.ok) {
        setSuccess(true);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  if (success) {
    return (
      <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm px-8 py-12 text-center">
        <p className="text-5xl mb-4">🎉</p>
        <h2 className="text-xl font-bold text-neutral-900 mb-2">Thanks for the feedback!</h2>
        <p className="text-sm text-neutral-500">The team will review it shortly.</p>
        <button
          onClick={() => { setSuccess(false); setTitle(""); setBody(""); setName(""); setEmail(""); setType("bug"); }}
          className="mt-6 text-sm text-indigo-600 hover:underline"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-white border border-neutral-200 shadow-sm px-6 py-6 space-y-5">
      {/* Type selector */}
      <div>
        <label className="block text-xs font-semibold text-neutral-700 mb-2">What kind of feedback?</label>
        <div className="grid grid-cols-2 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                type === t.value
                  ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300"
                  : "border-neutral-200 bg-white hover:border-neutral-300"
              }`}
            >
              <p className="text-sm font-medium text-neutral-900">{t.label}</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">{t.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Name + email */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Your name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
          />
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-medium text-neutral-700 mb-1">
          Subject <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={type === "bug" ? "Button not working on mobile" : "Add dark mode support"}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
        />
      </div>

      {/* Body */}
      <div>
        <label className="block text-xs font-medium text-neutral-700 mb-1">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          required
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            type === "bug"
              ? "Steps to reproduce:\n1. \n2. \n\nExpected: \nActual: "
              : "Describe your idea or question in as much detail as you like..."
          }
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 resize-none"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
