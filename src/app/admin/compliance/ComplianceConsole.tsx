"use client";

import { useState, useTransition } from "react";
import { createComplianceRequestAction, updateComplianceStatusAction } from "./actions";
import StatsRow from "@/components/patterns/admin/StatsRow";
import AdminTable, { type AdminTableCell } from "@/components/patterns/admin/AdminTable";
import Note from "@/components/patterns/admin/Note";

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

const inputCls = "w-full rounded-lg border border-[#ddd8c9] bg-white px-3 py-2 text-[12.5px] text-[#20201d] outline-none focus:border-[#c9791d]";

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

  return (
    <div className="mt-4 space-y-5">
      {error && <Note icon="⚠" tone="error">{error}</Note>}

      <StatsRow
        items={[
          { label: "Pending", value: pendingCount, color: pendingCount > 0 ? "#c9791d" : undefined },
          { label: "In progress", value: inProgressCount },
          { label: "Completed this month", value: completedThisMonth, color: "#3f7d4c" },
        ]}
      />

      {/* New request toggle */}
      <div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md border border-[#ddd8c9] px-4 py-[7px] text-[12px] font-semibold"
          style={showForm ? { background: "#f4f2eb", color: "#4a473e" } : { background: "#c9791d", color: "#fff", borderColor: "#c9791d" }}
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
            <button onClick={submitRequest} disabled={isPending} className="mt-3 rounded-md border border-[#c9791d] bg-[#c9791d] px-4 py-[7px] text-[12px] font-semibold text-white disabled:opacity-50">
              Submit Request
            </button>
          </div>
        )}
      </div>

      {/* Requests table */}
      {requests.length === 0 ? (
        <div className="fw-card py-12 text-center text-[13px] text-[#a19d90]">No compliance requests yet.</div>
      ) : (
        <AdminTable
          minWidth={900}
          columns={[
            { label: "Type", width: 140 },
            { label: "Requester", flex: true },
            { label: "Tenant", width: 140 },
            { label: "Status", width: 110 },
            { label: "Regulation", width: 100 },
            { label: "Created", width: 100 },
            { label: "Actions", width: 190 },
          ]}
          rows={requests.map((req): AdminTableCell[] => {
            const sc: Record<string, { fg: string; bg: string }> = {
              pending: { fg: "#c9791d", bg: "#fdf1de" },
              in_progress: { fg: "#3a6ea8", bg: "#eaf1f8" },
              completed: { fg: "#3f7d4c", bg: "#e9f3ea" },
              denied: { fg: "#c0392b", bg: "#fbeae8" },
            };
            const c = sc[req.status] ?? { fg: "#726e60", bg: "#f1efe9" };
            return [
              { kind: "bold", value: TYPE_LABELS[req.request_type] ?? req.request_type },
              { kind: "text", value: req.requester_email },
              { kind: "dim", value: req.tenant_name ?? "—" },
              { kind: "chip", value: req.status, chipFg: c.fg, chipBg: c.bg },
              { kind: "dim", value: req.regulation },
              { kind: "dim", value: timeAgo(req.created_at) },
              {
                kind: "text",
                value: (
                  <div className="flex flex-wrap gap-2.5 text-[11.5px] font-semibold">
                    {req.request_type === "export" && (
                      <a href={`/api/admin/compliance/export?email=${encodeURIComponent(req.requester_email)}`} download className="text-[#3a6ea8] hover:underline">Download</a>
                    )}
                    {req.request_type === "deletion" && req.status !== "completed" && req.status !== "denied" && (
                      <button onClick={() => { if (!confirm(`Permanently erase all data for ${req.requester_email}?`)) return; run(async () => { const res = await fetch("/api/admin/compliance/erase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: req.requester_email }) }); if (!res.ok) throw new Error((await res.json()).error ?? "Erasure failed"); await updateComplianceStatusAction(req.id, "completed", "Automated erasure completed."); }); }} disabled={isPending} className="text-[#c0392b] disabled:opacity-40">Erase</button>
                    )}
                    {req.status === "pending" && (
                      <button onClick={() => run(() => updateComplianceStatusAction(req.id, "in_progress"))} disabled={isPending} className="text-[#c9791d] disabled:opacity-40">Start</button>
                    )}
                    {(req.status === "pending" || req.status === "in_progress") && (
                      <>
                        <button onClick={() => run(() => updateComplianceStatusAction(req.id, "completed"))} disabled={isPending} className="text-[#3f7d4c] disabled:opacity-40">Complete</button>
                        <button onClick={() => run(() => updateComplianceStatusAction(req.id, "denied"))} disabled={isPending} className="text-[#c0392b] disabled:opacity-40">Deny</button>
                      </>
                    )}
                  </div>
                ),
              },
            ];
          })}
        />
      )}
    </div>
  );
}
