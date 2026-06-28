"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface ScheduledReport {
  id: string; name: string; report_type: string; cadence: string;
  day_of_week: number; recipients: string[]; is_active: boolean;
  last_sent_at: string | null; next_send_at: string | null; config: Record<string, unknown>;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CADENCE_LABELS: Record<string, string> = { daily: "Daily", weekly: "Weekly", biweekly: "Bi-weekly", monthly: "Monthly" };
const REPORT_TYPE_LABELS: Record<string, string> = { custom: "Custom Builder", velocity: "Velocity", aging: "Issue Aging", cycle_time: "Cycle Time" };

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ScheduledClient({ slug, isAdmin }: { slug: string; isAdmin: boolean }) {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "", report_type: "custom", cadence: "weekly",
    day_of_week: 5, recipients: "", is_active: true,
  });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/reports/scheduled", { headers: { "x-tenant-slug": slug } });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const json = await res.json();
      setReports(json.data ?? []);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.recipients.trim()) return;
    setSaving(true);
    try {
      const recipients = form.recipients.split(",").map((r) => r.trim()).filter(Boolean);
      const res = await fetch("/api/reports/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
        body: JSON.stringify({ ...form, recipients }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setShowForm(false);
      setForm({ name: "", report_type: "custom", cadence: "weekly", day_of_week: 5, recipients: "", is_active: true });
      void load();
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  async function handleToggle(report: ScheduledReport) {
    await fetch("/api/reports/scheduled", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-tenant-slug": slug },
      body: JSON.stringify({ id: report.id, is_active: !report.is_active }),
    });
    void load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this scheduled report?")) return;
    await fetch(`/api/reports/scheduled?id=${id}`, { method: "DELETE", headers: { "x-tenant-slug": slug } });
    void load();
  }

  return (
    <div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Scheduled Reports</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Automatically email reports to stakeholders on a recurring schedule.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shrink-0">
            + New Schedule
          </button>
        )}
      </div>

      {/* Delivery notice */}
      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex gap-3">
        <span className="text-blue-500 text-lg mt-0.5">ℹ</span>
        <div>
          <p className="text-sm font-semibold text-blue-800">Delivery runs at 8am on the scheduled day</p>
          <p className="text-xs text-blue-700 mt-0.5">Reports are generated fresh and emailed as PDF attachments to all recipients.</p>
        </div>
      </div>

      {/* Create form */}
      {showForm && isAdmin && (
        <form onSubmit={(e) => { void handleCreate(e); }}
          className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-5">
          <h3 className="text-sm font-bold text-indigo-900 mb-4">New Scheduled Report</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-indigo-700 mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Weekly stakeholder update"
                className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-indigo-700 mb-1">Report Type</label>
              <select value={form.report_type} onChange={(e) => setForm((f) => ({ ...f, report_type: e.target.value }))}
                className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {Object.entries(REPORT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-indigo-700 mb-1">Cadence</label>
              <select value={form.cadence} onChange={(e) => setForm((f) => ({ ...f, cadence: e.target.value }))}
                className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {Object.entries(CADENCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {form.cadence !== "daily" && form.cadence !== "monthly" && (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-indigo-700 mb-1">Day of Week</label>
                <select value={form.day_of_week} onChange={(e) => setForm((f) => ({ ...f, day_of_week: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-indigo-700 mb-1">Recipients (comma-separated emails)</label>
              <input value={form.recipients} onChange={(e) => setForm((f) => ({ ...f, recipients: e.target.value }))}
                placeholder="ceo@company.com, cto@company.com"
                className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || !form.name.trim() || !form.recipients.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors">
              {saving ? "Saving…" : "Create Schedule"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.includes("schema cache") || error.includes("scheduled_reports")
            ? "Setup required: run migration 0084_scheduled_reports.sql in Supabase before using this feature."
            : error}
        </div>
      )}
      {loading && <div className="text-center py-12 text-neutral-400 text-sm">Loading schedules…</div>}

      {!loading && reports.length === 0 && (
        <div className="text-center py-16 text-neutral-400">
          <div className="text-4xl mb-3">📬</div>
          <p className="text-sm font-medium">No scheduled reports yet.</p>
          <p className="text-xs mt-1">Create a schedule to automatically email reports to stakeholders.</p>
        </div>
      )}

      {!loading && reports.length > 0 && (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className={`rounded-xl border bg-white p-4 shadow-sm transition ${r.is_active ? "border-neutral-200" : "border-neutral-100 opacity-60"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-neutral-900">{r.name}</span>
                    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                      {REPORT_TYPE_LABELS[r.report_type] ?? r.report_type}
                    </span>
                    {!r.is_active && <span className="text-[10px] text-neutral-400 font-medium">PAUSED</span>}
                  </div>
                  <p className="text-xs text-neutral-500">
                    {CADENCE_LABELS[r.cadence] ?? r.cadence}
                    {r.cadence !== "daily" && r.cadence !== "monthly" ? ` · ${DAY_NAMES[r.day_of_week ?? 5]}s` : ""}
                    {" · "}{r.recipients.length} recipient{r.recipients.length !== 1 ? "s" : ""}
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Last sent: {fmtDate(r.last_sent_at)} · Next: {fmtDate(r.next_send_at)}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => void handleToggle(r)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${r.is_active ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"}`}>
                      {r.is_active ? "Pause" : "Resume"}
                    </button>
                    <button onClick={() => void handleDelete(r.id)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors">
                      Delete
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {r.recipients.map((email) => (
                  <span key={email} className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600">{email}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
