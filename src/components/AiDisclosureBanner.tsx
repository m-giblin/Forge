"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { dismissAiDisclosureAction } from "@/app/[tenant]/actions";

export default function AiDisclosureBanner({ slug, initiallyDismissed }: { slug: string; initiallyDismissed: boolean }) {
  const [dismissed, setDismissed] = useState(initiallyDismissed);
  const [, startTransition] = useTransition();

  function dismiss() {
    setDismissed(true); // optimistic — don't make the user wait on a round trip to lose the banner
    startTransition(() => {
      dismissAiDisclosureAction(slug).catch(() => { /* best-effort; worst case it reappears next session */ });
    });
  }

  if (dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 shadow-lg">
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0">🤖</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-indigo-900">AI features active</p>
          <p className="text-xs text-indigo-700 mt-0.5 leading-relaxed">
            Forge uses AI (Grok / Claude) for issue triage, Think Tank, and digests. Your data is processed only on your configured AI provider. Data is not used to train models.{" "}
            <Link href="/legal/ai-policy" className="underline font-medium">Learn more</Link>
          </p>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 text-indigo-400 hover:text-indigo-600 text-lg leading-none mt-0.5"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
