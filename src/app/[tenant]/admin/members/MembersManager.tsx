"use client";

import { useState, useTransition } from "react";
import {
  createInviteAction,
  revokeInviteAction,
  changeRoleAction,
  removeMemberAction,
  setJobTitlesAction,
  assignCustomRoleAction,
} from "./actions";
import type { MembershipRole } from "@/lib/repositories/members";
import { COLOR_CLASSES, type RoleColor } from "@/lib/rbac";

type CustomRoleOption = { id: string; name: string; color: string };

const JOB_TITLE_OPTIONS = [
  "Developer",
  "Designer",
  "QA Engineer",
  "Product Manager",
  "Team Lead",
  "Scrum Master",
  "Stakeholder",
  "Consultant",
  "DevOps",
  "Data Analyst",
] as const;

const TITLE_COLORS: Record<string, string> = {
  "Developer":       "bg-blue-100 text-blue-700 border-blue-200",
  "Designer":        "bg-violet-100 text-violet-700 border-violet-200",
  "QA Engineer":     "bg-rose-100 text-rose-700 border-rose-200",
  "Product Manager": "bg-amber-100 text-amber-700 border-amber-200",
  "Team Lead":       "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Scrum Master":    "bg-cyan-100 text-cyan-700 border-cyan-200",
  "Stakeholder":     "bg-orange-100 text-orange-700 border-orange-200",
  "Consultant":      "bg-indigo-100 text-indigo-700 border-indigo-200",
  "DevOps":          "bg-teal-100 text-teal-700 border-teal-200",
  "Data Analyst":    "bg-pink-100 text-pink-700 border-pink-200",
};
const DEFAULT_TITLE_COLOR = "bg-neutral-100 text-neutral-600 border-neutral-200";

type Member = {
  membershipId: string;
  role: MembershipRole;
  userId: string;
  email: string;
  name: string | null;
  jobTitles: string[];
  customRoleId: string | null;
  customRoleName: string | null;
  customRoleColor: string | null;
};
type Invite = { id: string; email: string | null; role: MembershipRole; expires_at: string };

const MEMBER_ROLES: MembershipRole[] = ["owner", "admin", "member", "viewer"];
const INVITE_ROLES: MembershipRole[] = ["admin", "member", "viewer"];

const ROLE_DESC: Record<string, string> = {
  admin:  "Can manage members, projects, and settings",
  member: "Can view and work on assigned projects",
  viewer: "Read-only access to projects",
};

// ── Job title pill picker (reused in both invite modal and member row) ─────────
function JobTitlePicker({
  current,
  onSave,
  onClose,
}: {
  current: string[];
  onSave: (titles: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(current);
  function toggle(t: string) {
    setSelected((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-2.5 shadow-md w-64">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Select titles</p>
      <div className="flex flex-wrap gap-1.5">
        {JOB_TITLE_OPTIONS.map((t) => {
          const active = selected.includes(t);
          const color = active ? (TITLE_COLORS[t] ?? DEFAULT_TITLE_COLOR) : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-400";
          return (
            <button key={t} type="button" onClick={() => toggle(t)}
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${color}`}>
              {t}
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex justify-end gap-2 border-t border-neutral-100 pt-2">
        <button onClick={onClose} className="text-xs text-neutral-400 hover:text-neutral-600">Cancel</button>
        <button onClick={() => onSave(selected)}
          className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700">
          Save
        </button>
      </div>
    </div>
  );
}

// ── Invite modal ───────────────────────────────────────────────────────────────
function InviteModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [role, setRole]           = useState<MembershipRole>("member");
  const [titles, setTitles]       = useState<string[]>([]);
  const [link, setLink]           = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleTitle(t: string) {
    setTitles((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const { token } = await createInviteAction(slug, {
          email: email.trim() || null,
          role,
          displayName: name.trim() || null,
          jobTitles: titles,
        });
        setLink(`${window.location.origin}/join/${token}`);
        setCopied(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create invite");
      }
    });
  }

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
  }

  const field = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900";
  const label = "block text-xs font-medium text-neutral-600 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <h2 className="text-base font-semibold text-neutral-900">Invite team member</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!link ? (
          <form onSubmit={submit} className="p-6 space-y-4">
            {/* Name */}
            <div>
              <label className={label}>Name <span className="text-neutral-400">(optional — pre-fills their profile)</span></label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Chen" className={field} />
            </div>

            {/* Email */}
            <div>
              <label className={label}>Email <span className="text-neutral-400">(optional — locks invite to this address)</span></label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@company.com" className={field} />
            </div>

            {/* Role */}
            <div>
              <label className={label}>Role</label>
              <div className="grid grid-cols-3 gap-2">
                {INVITE_ROLES.map((r) => (
                  <button key={r} type="button" onClick={() => setRole(r)}
                    className={`rounded-lg border px-3 py-2 text-left transition ${role === r ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"}`}>
                    <div className="text-sm font-medium capitalize">{r}</div>
                    <div className={`mt-0.5 text-[10px] leading-tight ${role === r ? "text-neutral-300" : "text-neutral-400"}`}>{ROLE_DESC[r]}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Job titles */}
            <div>
              <label className={label}>Job title <span className="text-neutral-400">(optional)</span></label>
              <div className="flex flex-wrap gap-1.5">
                {JOB_TITLE_OPTIONS.map((t) => {
                  const active = titles.includes(t);
                  const color = active ? (TITLE_COLORS[t] ?? DEFAULT_TITLE_COLOR) : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-400";
                  return (
                    <button key={t} type="button" onClick={() => toggleTitle(t)}
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${color}`}>
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div className="flex items-center justify-end gap-3 border-t border-neutral-100 pt-2">
              <button type="button" onClick={onClose} className="text-sm text-neutral-500 hover:text-neutral-700">Cancel</button>
              <button type="submit" disabled={pending}
                className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
                {pending ? "Creating…" : "Create invite link"}
              </button>
            </div>
          </form>
        ) : (
          /* Success state — show link */
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900">Invite link ready</p>
                <p className="text-xs text-neutral-500">Single-use · expires in 7 days</p>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <p className="mb-2 text-xs font-medium text-neutral-500">Share this link with {name || "the invitee"}:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded bg-white border border-neutral-200 px-2 py-1.5 text-xs text-neutral-700 select-all">
                  {link}
                </code>
              </div>
              <button onClick={copyLink}
                className={`mt-2 w-full rounded-lg py-2 text-sm font-medium transition ${copied ? "bg-emerald-600 text-white" : "bg-neutral-900 text-white hover:bg-neutral-700"}`}>
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-neutral-100 pt-2">
              <button onClick={() => { setLink(null); setName(""); setEmail(""); setRole("member"); setTitles([]); setCopied(false); }}
                className="text-sm text-neutral-500 hover:text-neutral-700">
                Invite another
              </button>
              <button onClick={onClose} className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function MembersManager({
  slug,
  currentUserId,
  members,
  invites,
  readOnly = false,
  showJobTitles = false,
  showRbac = false,
  customRoles = [],
}: {
  slug: string;
  currentUserId: string;
  members: Member[];
  invites: Invite[];
  readOnly?: boolean;
  showJobTitles?: boolean;
  showRbac?: boolean;
  customRoles?: CustomRoleOption[];
}) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [pending, startTransition]            = useTransition();
  const [editingTitlesFor, setEditingTitlesFor] = useState<string | null>(null);
  const [assigningRoleTo, setAssigningRoleTo]   = useState<string | null>(null);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try { await fn(); }
      catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    });
  }

  return (
    <div className="mt-6 space-y-6">
      {showInviteModal && <InviteModal slug={slug} onClose={() => setShowInviteModal(false)} />}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-800">Team members <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">{members.length}</span></h2>
          {invites.length > 0 && (
            <p className="mt-0.5 text-xs text-neutral-400">{invites.length} pending invite{invites.length !== 1 ? "s" : ""}</p>
          )}
        </div>
        {!readOnly && (
          <button onClick={() => setShowInviteModal(true)}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
            + Invite member
          </button>
        )}
      </div>

      {/* Pending invites strip */}
      {!readOnly && invites.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">Pending invites</p>
          <ul className="space-y-1.5">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between text-sm">
                <span className="text-neutral-700">
                  <span className="capitalize font-medium">{inv.role}</span>
                  {inv.email ? ` · ${inv.email}` : " · any email"}
                </span>
                <button onClick={() => run(() => revokeInviteAction(slug, inv.id))}
                  className="text-xs font-medium text-red-600 hover:underline">
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Members table */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-400">
              <th className="px-4 py-2.5 font-medium">Member</th>
              {showJobTitles && <th className="px-4 py-2.5 font-medium">Job Title</th>}
              {showRbac && <th className="px-4 py-2.5 font-medium">Custom Role</th>}
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.membershipId} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2.5">
                  <div className="text-neutral-800">{m.name || m.email}</div>
                  {m.name && <div className="text-xs text-neutral-400">{m.email}</div>}
                </td>

                {showRbac && (
                  <td className="px-4 py-2.5">
                    {assigningRoleTo === m.membershipId ? (
                      <select autoFocus defaultValue={m.customRoleId ?? ""}
                        onChange={(e) => { run(() => assignCustomRoleAction(slug, m.membershipId, e.target.value || null)); setAssigningRoleTo(null); }}
                        onBlur={() => setAssigningRoleTo(null)}
                        className="rounded border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-indigo-400">
                        <option value="">— None (system defaults) —</option>
                        {customRoles.map((cr) => <option key={cr.id} value={cr.id}>{cr.name}</option>)}
                      </select>
                    ) : m.customRoleName ? (
                      <button onClick={() => !readOnly && setAssigningRoleTo(m.membershipId)} disabled={readOnly} className="disabled:pointer-events-none">
                        {(() => {
                          const cc = COLOR_CLASSES[(m.customRoleColor ?? "indigo") as RoleColor] ?? COLOR_CLASSES.indigo;
                          return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cc.bg} ${cc.text} ${cc.border}`}>{m.customRoleName}</span>;
                        })()}
                      </button>
                    ) : (
                      <button onClick={() => !readOnly && setAssigningRoleTo(m.membershipId)} disabled={readOnly}
                        className="text-xs italic text-neutral-300 hover:text-neutral-500 disabled:pointer-events-none">
                        Assign role…
                      </button>
                    )}
                  </td>
                )}

                {showJobTitles && (
                  <td className="px-4 py-2.5">
                    {editingTitlesFor === m.membershipId ? (
                      <JobTitlePicker current={m.jobTitles}
                        onSave={(titles) => { run(() => setJobTitlesAction(slug, m.membershipId, titles)); setEditingTitlesFor(null); }}
                        onClose={() => setEditingTitlesFor(null)} />
                    ) : (
                      <button onClick={() => !readOnly && setEditingTitlesFor(m.membershipId)} disabled={readOnly}
                        className="flex flex-wrap gap-1 disabled:pointer-events-none">
                        {m.jobTitles.length > 0 ? m.jobTitles.map((t) => (
                          <span key={t} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TITLE_COLORS[t] ?? DEFAULT_TITLE_COLOR}`}>{t}</span>
                        )) : (
                          <span className="text-xs italic text-neutral-300 hover:text-neutral-500">Add titles…</span>
                        )}
                      </button>
                    )}
                  </td>
                )}

                <td className="px-4 py-2.5">
                  <select value={m.role} disabled={pending || readOnly}
                    onChange={(e) => run(() => changeRoleAction(slug, m.membershipId, e.target.value as MembershipRole))}
                    className="rounded-lg border border-neutral-300 px-2 py-1 text-sm capitalize disabled:opacity-60">
                    {MEMBER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>

                <td className="px-4 py-2.5 text-right">
                  {m.userId !== currentUserId && !readOnly && (
                    <button onClick={() => { if (confirm("Remove this member from the workspace?")) run(() => removeMemberAction(slug, m.membershipId)); }}
                      className="text-xs font-medium text-red-600 hover:underline">
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
