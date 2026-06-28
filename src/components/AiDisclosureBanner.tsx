"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const STORAGE_KEY = "forge:ai-disclosure-dismissed";

export default function AiDisclosureBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  function dismiss() {
    try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch { /* */ }
    setVisible(false);
  }

  if (!visible) return null;

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
