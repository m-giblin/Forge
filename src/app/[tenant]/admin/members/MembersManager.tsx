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
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${color}`}
            >
              {t}
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex justify-end gap-2 border-t border-neutral-100 pt-2">
        <button onClick={onClose} className="text-xs text-neutral-400 hover:text-neutral-600">Cancel</button>
        <button
          onClick={() => onSave(selected)}
          className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700"
        >
          Save
        </button>
      </div>
    </div>
  );
}

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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editingTitlesFor, setEditingTitlesFor] = useState<string | null>(null);
  const [assigningRoleTo, setAssigningRoleTo] = useState<string | null>(null);

  // invite form
  const [inviteRole, setInviteRole] = useState<MembershipRole>("member");
  const [inviteEmail, setInviteEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function createInvite() {
    setError(null);
    startTransition(async () => {
      try {
        const { token } = await createInviteAction(slug, { role: inviteRole, email: inviteEmail || null });
        setLink(`${window.location.origin}/join/${token}`);
        setCopied(false);
        setInviteEmail("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create invite");
      }
    });
  }

  return (
    <div className="mt-6 space-y-6">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Invite */}
      {!readOnly && (
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-800">Invite a teammate</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as MembershipRole)}
              className="rounded-lg border border-neutral-300 px-2 py-2 text-sm capitalize"
            >
              {INVITE_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Bind to email <span className="text-neutral-400">(optional)</span>
            </label>
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="only this address can accept"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          </div>
          <button
            onClick={createInvite}
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            Create invite link
          </button>
        </div>

        {link && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-900">Single-use link — share it with the invitee:</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-white px-2 py-1.5 text-xs text-neutral-800">{link}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(link); setCopied(true); }}
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {invites.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-medium text-neutral-500">Pending invites</p>
            <ul className="divide-y divide-neutral-100">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-neutral-700">
                    <span className="capitalize">{inv.role}</span>
                    {inv.email ? ` · ${inv.email}` : " · any email"}
                  </span>
                  <button
                    onClick={() => run(() => revokeInviteAction(slug, inv.id))}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      )}

      {/* Members */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-400">
              <th className="px-4 py-2.5 font-medium">Member</th>
              {showJobTitles && <th className="px-4 py-2.5 font-medium">Job Title</th>}
              {showRbac && <th className="px-4 py-2.5 font-medium">Custom Role</th>}
              <th className="px-4 py-2.5 font-medium">System Role</th>
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
                      <div className="flex items-center gap-1.5">
                        <select
                          autoFocus
                          defaultValue={m.customRoleId ?? ""}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            run(() => assignCustomRoleAction(slug, m.membershipId, val));
                            setAssigningRoleTo(null);
                          }}
                          onBlur={() => setAssigningRoleTo(null)}
                          className="rounded border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-indigo-400"
                        >
                          <option value="">— None (system defaults) —</option>
                          {customRoles.map((cr) => (
                            <option key={cr.id} value={cr.id}>{cr.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : m.customRoleName ? (
                      <button
                        onClick={() => !readOnly && setAssigningRoleTo(m.membershipId)}
                        disabled={readOnly}
                        className="disabled:pointer-events-none"
                      >
                        {(() => {
                          const cc = COLOR_CLASSES[(m.customRoleColor ?? "indigo") as RoleColor] ?? COLOR_CLASSES.indigo;
                          return (
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cc.bg} ${cc.text} ${cc.border}`}>
                              {m.customRoleName}
                            </span>
                          );
                        })()}
                      </button>
                    ) : (
                      <button
                        onClick={() => !readOnly && setAssigningRoleTo(m.membershipId)}
                        disabled={readOnly}
                        className="text-xs italic text-neutral-300 hover:text-neutral-500 disabled:pointer-events-none"
                      >
                        Assign role…
                      </button>
                    )}
                  </td>
                )}
                {showJobTitles && (
                  <td className="px-4 py-2.5">
                    {editingTitlesFor === m.membershipId ? (
                      <JobTitlePicker
                        current={m.jobTitles}
                        onSave={(titles) => {
                          run(() => setJobTitlesAction(slug, m.membershipId, titles));
                          setEditingTitlesFor(null);
                        }}
                        onClose={() => setEditingTitlesFor(null)}
                      />
                    ) : (
                      <button
                        onClick={() => !readOnly && setEditingTitlesFor(m.membershipId)}
                        disabled={readOnly}
                        className="flex flex-wrap gap-1 disabled:pointer-events-none"
                      >
                        {m.jobTitles.length > 0 ? m.jobTitles.map((t) => (
                          <span key={t} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TITLE_COLORS[t] ?? DEFAULT_TITLE_COLOR}`}>
                            {t}
                          </span>
                        )) : (
                          <span className="text-xs italic text-neutral-300 hover:text-neutral-500">Add titles…</span>
                        )}
                      </button>
                    )}
                  </td>
                )}
                <td className="px-4 py-2.5">
                  <select
                    value={m.role}
                    disabled={pending || readOnly}
                    onChange={(e) => run(() => changeRoleAction(slug, m.membershipId, e.target.value as MembershipRole))}
                    className="rounded-lg border border-neutral-300 px-2 py-1 text-sm capitalize disabled:opacity-60"
                  >
                    {MEMBER_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {m.userId !== currentUserId && !readOnly && (
                    <button
                      onClick={() => {
                        if (confirm("Remove this member from the workspace?")) run(() => removeMemberAction(slug, m.membershipId));
                      }}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
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
