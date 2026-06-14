"use client";

import { useTransition } from "react";
import { stopImpersonationAction } from "@/app/impersonation-actions";

export default function ImpersonationBanner({ tenantName }: { tenantName: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <span>
        Support view — you&rsquo;re viewing <strong>{tenantName}</strong> read-only as a platform admin.
      </span>
      <button
        onClick={() => startTransition(() => stopImpersonationAction())}
        disabled={pending}
        className="rounded-md bg-amber-950/90 px-2.5 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-950 disabled:opacity-60"
      >
        {pending ? "Exiting…" : "Exit support view"}
      </button>
    </div>
  );
}
