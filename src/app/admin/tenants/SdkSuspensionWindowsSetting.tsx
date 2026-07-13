"use client";

import { useState, useTransition } from "react";
import { saveSdkSuspensionWindowsAction } from "../actions";

/**
 * Graduated grace period after a tenant is suspended (see
 * src/lib/services/sdkFallbackAlerts.ts for the full policy): full alert for
 * the first `notifyDays`, a "this is about to stop" warning for the rest of
 * `graceDays`, then the API gate itself starts rejecting the tenant's key.
 */
export default function SdkSuspensionWindowsSetting({ notifyDays, graceDays }: { notifyDays: number; graceDays: number }) {
  const [notify, setNotify] = useState(String(notifyDays));
  const [grace, setGrace] = useState(String(graceDays));
  const [saving, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const invalid = !notify || !grace || Number(notify) < 1 || Number(grace) < Number(notify);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#6b7280", flexWrap: "wrap" }}>
      <span>Suspended tenants: full alert for</span>
      <input type="number" min="1" max="365" value={notify} onChange={(e) => setNotify(e.target.value)}
        style={{ width: 52, padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb", textAlign: "center", fontSize: 12, color: "#111827", outline: "none" }} />
      <span>days, then warn until</span>
      <input type="number" min="1" max="365" value={grace} onChange={(e) => setGrace(e.target.value)}
        style={{ width: 52, padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb", textAlign: "center", fontSize: 12, color: "#111827", outline: "none" }} />
      <span>days, then reject SDK intake</span>
      <button disabled={saving || invalid}
        onClick={() => start(async () => { await saveSdkSuspensionWindowsAction(Number(notify), Number(grace)); setSaved(true); setTimeout(() => setSaved(false), 2000); })}
        style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#f8fafc", color: "#374151", fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: saving || invalid ? .4 : 1 }}>
        {saving ? "…" : saved ? "✓ Saved" : "Save"}
      </button>
    </div>
  );
}
