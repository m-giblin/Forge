"use client";

import { useState, useTransition } from "react";
import { createComplianceRequestAction, updateComplianceStatusAction } from "./actions";

type ComplianceRequest = {
  id: string;
  tenant_id: string | null;
  tenant_name: string | null;
  request_type: string;
  requester_email: string;
  status: string;
  regulation: string;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
};

type Tenant = { id: string; name: string; slug: string };

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  pending:     { background: "#fffbeb", color: "#d97706" },
  in_progress: { background: "#eff6ff", color: "#2563eb" },
  completed:   { background: "#f0fdf4", color: "#16a34a" },
  denied:      { background: "#fef2f2", color: "#dc2626" },
};

const TYPE_LABELS: Record<string, string> = {
  deletion:   "Data Deletion",
  export:     "Data Export",
  correction: "Data Correction",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function thisMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-400";

export default function ComplianceConsole({ requests, tenants }: { requests: ComplianceRequest[]; tenants: Tenant[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [reqType, setReqType] = useState<"deletion" | "export" | "correction">("deletion");
  const [reqEmail, setReqEmail] = useState("");
  const [reqTenant, setReqTenant] = useState("");
  const [reqRegulation, setReqRegulation] = useState("GDPR");
  const [reqNotes, setReqNotes] = useState("");

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Action failed."); }
    });
  }

  function submitRequest() {
    if (!reqEmail) { setError("Requester email is required."); return; }
    run(async () => {
      await createComplianceRequestAction({ request_type: reqType, requester_email: reqEmail, tenant_id: reqTenant || null, regulation: reqRegulation, notes: reqNotes });
      setShowForm(false); setReqType("deletion"); setReqEmail(""); setReqTenant(""); setReqRegulation("GDPR"); setReqNotes("");
    });
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const inProgressCount = requests.filter((r) => r.status === "in_progress").length;
  const completedThisMonth = requests.filter((r) => r.status === "completed" && r.completed_at && thisMonth(r.completed_at)).length;

  const kpiCard: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px" };

  return (
    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 20 }}>
      {error && <div style={{ padding: "9px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, fontSize: 12, color: "#dc2626" }}>{error}</div>}

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <div style={kpiCard}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>Pending</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: pendingCount > 0 ? "#d97706" : "#111827", marginTop: 4 }}>{pendingCount}</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>In Progress</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#111827", marginTop: 4 }}>{inProgressCount}</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>Completed This Month</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#111827", marginTop: 4 }}>{completedThisMonth}</div>
        </div>
      </div>

      {/* New request toggle */}
      <div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid #e5e7eb", background: showForm ? "#f8fafc" : "#4f46e5", color: showForm ? "#374151" : "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          {showForm ? "Cancel" : "New Request"}
        </button>

        {showForm && (
          <div style={{ marginTop: 12, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 14 }}>New Compliance Request</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4 }}>Request Type</label>
                <select value={reqType} onChange={(e) => setReqType(e.target.value as "deletion" | "export" | "correction")} className={inputCls}>
                  <option value="deletion">Data Deletion (Art. 17)</option>
                  <option value="export">Data Export (Art. 20)</option>
                  <option value="correction">Data Correction (Art. 16)</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4 }}>Regulation</label>
                <select value={reqRegulation} onChange={(e) => setReqRegulation(e.target.value)} className={inputCls}>
                  <option value="GDPR">GDPR</option>
                  <option value="CCPA">CCPA</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4 }}>Requester Email</label>
                <input type="email" value={reqEmail} onChange={(e) => setReqEmail(e.target.value)} placeholder="user@example.com" className={inputCls} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4 }}>Tenant (optional)</label>
                <select value={reqTenant} onChange={(e) => setReqTenant(e.target.value)} className={inputCls}>
                  <option value="">— No specific tenant —</option>
                  {tenants.map((t) => <option key={t.id} value={t.id}>{t.name} (/{t.slug})</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4 }}>Notes</label>
                <textarea value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} rows={3} placeholder="Context, case reference, etc." className={inputCls} style={{ resize: "none", fontFamily: "inherit" }} />
              </div>
            </div>
            <button onClick={submitRequest} disabled={isPending} style={{ marginTop: 12, padding: "7px 16px", borderRadius: 7, border: "none", background: "#4f46e5", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: isPending ? .5 : 1 }}>
              Submit Request
            </button>
          </div>
        )}
      </div>

      {/* Requests table */}
      {requests.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "48px 24px", textAlign: "center", fontSize: 13, color: "#94a3b8" }}>
          No compliance requests yet.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                {["Type", "Requester", "Tenant", "Status", "Regulation", "Created", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "11px 14px", fontWeight: 600, color: "#111827" }}>{TYPE_LABELS[req.request_type] ?? req.request_type}</td>
                  <td style={{ padding: "11px 14px", color: "#4b5563", fontSize: 12 }}>{req.requester_email}</td>
                  <td style={{ padding: "11px 14px", color: "#6b7280" }}>{req.tenant_name ?? "—"}</td>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 9, fontSize: 11, fontWeight: 600, ...(STATUS_STYLES[req.status] ?? { background: "#f1f5f9", color: "#64748b" }) }}>
                      {req.status}
                    </span>
                  </td>
                  <td style={{ padding: "11px 14px", color: "#6b7280", fontSize: 12 }}>{req.regulation}</td>
                  <td style={{ padding: "11px 14px", color: "#94a3b8", fontSize: 12 }}>{timeAgo(req.created_at)}</td>
                  <td style={{ padding: "11px 14px" }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {req.request_type === "export" && (
                        <a href={`/api/admin/compliance/export?email=${encodeURIComponent(req.requester_email)}`} download style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", textDecoration: "none" }}>Download</a>
                      )}
                      {req.request_type === "deletion" && req.status !== "completed" && req.status !== "denied" && (
                        <button onClick={() => { if (!confirm(`Permanently erase all data for ${req.requester_email}?`)) return; run(async () => { const res = await fetch("/api/admin/compliance/erase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: req.requester_email }) }); if (!res.ok) throw new Error((await res.json()).error ?? "Erasure failed"); await updateComplianceStatusAction(req.id, "completed", "Automated erasure completed."); }); }} disabled={isPending} style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", background: "none", border: "none", cursor: "pointer", padding: 0, opacity: isPending ? .4 : 1 }}>Erase</button>
                      )}
                      {req.status === "pending" && (
                        <button onClick={() => run(() => updateComplianceStatusAction(req.id, "in_progress"))} disabled={isPending} style={{ fontSize: 12, fontWeight: 600, color: "#d97706", background: "none", border: "none", cursor: "pointer", padding: 0, opacity: isPending ? .4 : 1 }}>Start</button>
                      )}
                      {(req.status === "pending" || req.status === "in_progress") && (
                        <>
                          <button onClick={() => run(() => updateComplianceStatusAction(req.id, "completed"))} disabled={isPending} style={{ fontSize: 12, fontWeight: 600, color: "#16a34a", background: "none", border: "none", cursor: "pointer", padding: 0, opacity: isPending ? .4 : 1 }}>Complete</button>
                          <button onClick={() => run(() => updateComplianceStatusAction(req.id, "denied"))} disabled={isPending} style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", background: "none", border: "none", cursor: "pointer", padding: 0, opacity: isPending ? .4 : 1 }}>Deny</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
