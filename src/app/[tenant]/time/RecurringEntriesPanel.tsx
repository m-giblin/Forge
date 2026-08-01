"use client";

import { useState, useEffect, useTransition } from "react";
import {
  getRecurringEntriesAction,
  createRecurringEntryAction,
  toggleRecurringEntryAction,
  deleteRecurringEntryAction,
  searchIssuesForRecurringAction,
  type RecurringEntry,
} from "./recurringActions";
import { fmtMinutes } from "./timeHelpers";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function RecurringEntriesPanel({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<RecurringEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [issueQ, setIssueQ] = useState("");
  const [issueResults, setIssueResults] = useState<Array<{ id: string; title: string; number: number; projectKey: string }>>([]);
  const [selectedIssue, setSelectedIssue] = useState<{ id: string; title: string; number: number; projectKey: string } | null>(null);
  const [fMinutes, setFMinutes] = useState(30);
  const [fNote, setFNote] = useState("");
  const [fTag, setFTag] = useState("");
  const [fBillable, setFBillable] = useState(false);
  const [fFreq, setFFreq] = useState<"daily" | "weekly">("daily");
  const [fDays, setFDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || entries.length > 0) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      return getRecurringEntriesAction(slug);
    }).then((data) => {
      if (!cancelled && data) { setEntries(data); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [open, slug, entries.length]);

  useEffect(() => {
    if (!issueQ.trim() || selectedIssue) {
      setIssueResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      searchIssuesForRecurringAction(slug, issueQ).then((r) => { if (!cancelled) setIssueResults(r); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [issueQ, slug, selectedIssue]);

  function toggleDay(d: number) {
    setFDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort());
  }

  function resetForm() {
    setIssueQ(""); setSelectedIssue(null); setIssueResults([]);
    setFMinutes(30); setFNote(""); setFTag(""); setFBillable(false);
    setFFreq("daily"); setFDays([1,2,3,4,5]); setFormError(null);
    setShowForm(false);
  }

  function handleSave() {
    if (!selectedIssue) { setFormError("Select an issue."); return; }
    if (fMinutes <= 0) { setFormError("Enter at least 1 minute."); return; }
    if (fFreq === "weekly" && fDays.length === 0) { setFormError("Select at least one day."); return; }
    setFormError(null);
    startTransition(async () => {
      const res = await createRecurringEntryAction(slug, selectedIssue.id, fMinutes, fNote || null, fBillable, fTag || null, fFreq, fDays);
      if (!res.ok) { setFormError(res.error ?? "Failed"); return; }
      const updated = await getRecurringEntriesAction(slug);
      setEntries(updated);
      resetForm();
    });
  }

  function handleToggle(id: string, active: boolean) {
    startTransition(async () => {
      await toggleRecurringEntryAction(slug, id, active);
      setEntries((prev) => prev.map((e) => e.id === id ? { ...e, active } : e));
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteRecurringEntryAction(slug, id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setConfirmDelete(null);
    });
  }

  function fmtFrequency(e: RecurringEntry) {
    if (e.frequency === "daily") {
      const days = e.daysOfWeek.map((d) => DAY_LABELS[d]).join(", ");
      return days.length > 0 ? `Daily (${days})` : "Daily";
    }
    const days = e.daysOfWeek.map((d) => DAY_LABELS[d]).join(", ");
    return `Weekly on ${days || "—"}`;
  }

  return (
    <div className="mx-6 mb-6 rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-neutral-50 transition-colors"
      >
        <span className="text-sm font-semibold text-neutral-800">Recurring Entries</span>
        <svg className={`h-4 w-4 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-neutral-100 px-5 pb-5 pt-4 space-y-4">
          {loading && <p className="text-xs text-neutral-400">Loading…</p>}

          {!loading && entries.length === 0 && !showForm && (
            <p className="text-xs text-neutral-400">No recurring entries yet.</p>
          )}

          {!loading && entries.length > 0 && (
            <div className="space-y-2">
              {entries.map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {e.projectKey && (
                        <span className="text-[11px] font-bold text-[#b7452f]">
                          {e.projectKey}-{e.issueNumber}
                        </span>
                      )}
                      <span className="text-sm font-medium text-neutral-800 truncate">{e.issueTitle}</span>
                      <span className="text-xs text-neutral-500">{fmtMinutes(e.minutes)}</span>
                      {e.tag && (
                        <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-600">{e.tag}</span>
                      )}
                      {e.billable && (
                        <span className="rounded-full bg-[#e9f3ea] border border-[#3f7d4c]/30 px-2 py-0.5 text-[10px] font-medium text-[#3f7d4c]">bill.</span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5">{fmtFrequency(e)}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" className="sr-only" checked={e.active} onChange={(ev) => handleToggle(e.id, ev.target.checked)} />
                    <div className={`w-9 h-5 rounded-full transition-colors ${e.active ? "bg-[#b7452f]" : "bg-neutral-300"}`} />
                    <div className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${e.active ? "translate-x-4" : ""}`} />
                  </label>
                  {confirmDelete === e.id ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleDelete(e.id)} disabled={pending} className="text-xs text-red-600 font-medium hover:text-red-800">Delete</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-xs text-neutral-400 hover:text-neutral-600">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(e.id)} className="shrink-0 text-neutral-300 hover:text-red-500 transition-colors" aria-label="Delete">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {showForm && (
            <div className="rounded-xl border border-[#ddd8c9] bg-[#f4f2eb]/60 p-4 space-y-3">
              <p className="text-xs font-semibold text-neutral-700">New Recurring Entry</p>

              {/* Issue search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search issues…"
                  value={selectedIssue ? `${selectedIssue.projectKey}-${selectedIssue.number} – ${selectedIssue.title}` : issueQ}
                  onChange={(e) => { setIssueQ(e.target.value); setSelectedIssue(null); }}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#b7452f]"
                />
                {issueResults.length > 0 && !selectedIssue && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-auto rounded-xl border border-neutral-200 bg-white shadow-lg">
                    {issueResults.map((r) => (
                      <button key={r.id} type="button" onClick={() => { setSelectedIssue(r); setIssueQ(""); setIssueResults([]); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50">
                        <span className="text-xs font-bold text-[#b7452f] shrink-0">{r.projectKey}-{r.number}</span>
                        <span className="truncate text-sm text-neutral-700">{r.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Minutes */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-neutral-600 shrink-0">Minutes</label>
                <input type="number" min={1} value={fMinutes} onChange={(e) => setFMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[#b7452f]" />
                <span className="text-xs text-neutral-400">= {fmtMinutes(fMinutes)}</span>
              </div>

              {/* Note */}
              <input type="text" placeholder="Note (optional)" value={fNote} onChange={(e) => setFNote(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#b7452f]" />

              {/* Tag */}
              <div className="space-y-1">
                <p className="text-xs text-neutral-600">Tag</p>
                <div className="flex flex-wrap gap-1">
                  {["Development","Review","Meetings","Testing","Design","Planning","Support"].map((t) => (
                    <button key={t} type="button" onClick={() => setFTag(fTag === t ? "" : t)}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors ${fTag === t ? "bg-[#b7452f] text-white border-[#b7452f]" : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <input type="text" placeholder="or custom…" value={fTag} onChange={(e) => setFTag(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#b7452f]" />
              </div>

              {/* Billable */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={fBillable} onChange={(e) => setFBillable(e.target.checked)} className="rounded border-neutral-300 text-[#b7452f]" />
                <span className="text-xs text-neutral-700">Billable</span>
              </label>

              {/* Frequency */}
              <div className="flex items-center gap-3">
                {(["daily","weekly"] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setFFreq(f)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${fFreq === f ? "bg-[#b7452f] text-white border-[#b7452f]" : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"}`}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              {/* Days of week */}
              <div className="flex gap-1.5">
                {[1,2,3,4,5,6,0].map((d) => (
                  <button key={d} type="button" onClick={() => toggleDay(d)}
                    className={`w-9 h-9 rounded-full text-xs font-medium border transition-colors ${fDays.includes(d) ? "bg-[#b7452f] text-white border-[#b7452f]" : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"}`}>
                    {DAY_LABELS[d].slice(0,2)}
                  </button>
                ))}
              </div>

              {formError && <p className="text-xs text-red-600">{formError}</p>}

              <div className="flex items-center gap-2">
                <button onClick={handleSave} disabled={pending}
                  className="rounded-lg bg-[#b7452f] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#8c4632] disabled:opacity-50">
                  {pending ? "Saving…" : "Save"}
                </button>
                <button onClick={resetForm} className="text-xs text-neutral-400 hover:text-neutral-600">Cancel</button>
              </div>
            </div>
          )}

          {!showForm && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#b7452f] hover:text-[#8c4632] transition-colors">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add recurring entry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
