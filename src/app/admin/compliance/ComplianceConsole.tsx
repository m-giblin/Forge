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

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  in_progress: "bg-blue-500/15 text-blue-300",
  completed: "bg-green-500/15 text-green-300",
  denied: "bg-red-500/15 text-red-300",
};

const TYPE_LABELS: Record<string, string> = {
  deletion: "Data Deletion",
  export: "Data Export",
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

export default function ComplianceConsole({
  requests,
  tenants,
}: {
  requests: ComplianceRequest[];
  tenants: Tenant[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [reqType, setReqType] = useState<"deletion" | "export" | "correction">("deletion");
  const [reqEmail, setReqEmail] = useState("");
  const [reqTenant, setReqTenant] = useState("");
  const [reqRegulation, setReqRegulation] = useState("GDPR");
  const [reqNotes, setReqNotes] = useState("");

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed.");
      }
    });
  }

  function submitRequest() {
    if (!reqEmail) { setError("Requester email is required."); return; }
    run(async () => {
      await createComplianceRequestAction({
        request_type: reqType,
        requester_email: reqEmail,
        tenant_id: reqTenant || null,
        regulation: reqRegulation,
        notes: reqNotes,
      });
      setShowForm(false);
      setReqType("deletion");
      setReqEmail("");
      setReqTenant("");
      setReqRegulation("GDPR");
      setReqNotes("");
    });
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const inProgressCount = requests.filter((r) => r.status === "in_progress").length;
  const completedThisMonth = requests.filter(
    (r) => r.status === "completed" && r.completed_at && thisMonth(r.completed_at)
  ).length;

  return (
    <div className="mt-6 space-y-6">
      {error && (
        <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Pending</p>
          <p className={`mt-1 text-3xl font-semibold ${pendingCount > 0 ? "text-amber-400" : "text-white"}`}>{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">In Progress</p>
          <p className="mt-1 text-3xl font-semibold text-white">{inProgressCount}</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Completed This Month</p>
          <p className="mt-1 text-3xl font-semibold text-white">{completedThisMonth}</p>
        </div>
      </div>

      {/* New request */}
      <div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
        >
          {showForm ? "Cancel" : "New Request"}
        </button>

        {showForm && (
          <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">New Compliance Request</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-400">Request Type</label>
                <select
                  value={reqType}
                  onChange={(e) => setReqType(e.target.value as "deletion" | "export" | "correction")}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500"
                >
                  <option value="deletion">Data Deletion (Art. 17)</option>
                  <option value="export">Data Export (Art. 20)</option>
                  <option value="correction">Data Correction (Art. 16)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-400">Regulation</label>
                <select
                  value={reqRegulation}
                  onChange={(e) => setReqRegulation(e.target.value)}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500"
                >
                  <option value="GDPR">GDPR</option>
                  <option value="CCPA">CCPA</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-400">Requester Email</label>
                <input
                  type="email"
                  value={reqEmail}
                  onChange={(e) => setReqEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-400">Tenant (optional)</label>
                <select
                  value={reqTenant}
                  onChange={(e) => setReqTenant(e.target.value)}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500"
                >
                  <option value="">— No specific tenant —</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} (/{t.slug})</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-neutral-400">Notes</label>
                <textarea
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  rows={3}
                  placeholder="Context, case reference, etc."
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500 resize-none"
                />
              </div>
            </div>
            <button
              onClick={submitRequest}
              disabled={isPending}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200 disabled:opacity-40"
            >
              Submit Request
            </button>
          </div>
        )}
      </div>

      {/* Requests table */}
      {requests.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-12 text-center">
          <p className="text-sm text-neutral-500">No compliance requests yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Requester</th>
                <th className="px-4 py-2.5 font-medium">Tenant</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Regulation</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="border-b border-neutral-800/60 last:border-0">
                  <td className="px-4 py-3 font-medium text-neutral-200">
                    {TYPE_LABELS[req.request_type] ?? req.request_type}
                  </td>
                  <td className="px-4 py-3 text-neutral-300 text-xs">{req.requester_email}</td>
                  <td className="px-4 py-3 text-neutral-400">
                    {req.tenant_name ?? <span className="text-neutral-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[req.status] ?? "bg-neutral-700 text-neutral-400"}`}
                    >
                      {req.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-400 text-xs">{req.regulation}</td>
                  <td className="px-4 py-3 text-xs text-neutral-500">{timeAgo(req.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {req.status === "pending" && (
                        <button
                          onClick={() => run(() => updateComplianceStatusAction(req.id, "in_progress"))}
                          disabled={isPending}
                          className="text-xs font-medium text-amber-400 hover:underline disabled:opacity-40"
                        >
                          Start
                        </button>
                      )}
                      {(req.status === "pending" || req.status === "in_progress") && (
                        <>
                          <button
                            onClick={() => run(() => updateComplianceStatusAction(req.id, "completed"))}
                            disabled={isPending}
                            className="text-xs font-medium text-green-400 hover:underline disabled:opacity-40"
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => run(() => updateComplianceStatusAction(req.id, "denied"))}
                            disabled={isPending}
                            className="text-xs font-medium text-red-400 hover:underline disabled:opacity-40"
                          >
                            Deny
                          </button>
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
