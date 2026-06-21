"use client";

import { useState, useTransition } from "react";
import {
  createInviteAction,
  revokeInviteAction,
  changeRoleAction,
  removeMemberAction,
  setJobTitleAction,
  assignCustomRoleAction,
} from "./actions";
import type { MembershipRole } from "@/lib/repositories/members";
import { COLOR_CLASSES, type RoleColor } from "@/lib/rbac";

type CustomRoleOption = { id: string; name: string; color: string };
type Member = {
  membershipId: string;
  role: MembershipRole;
  userId: string;
  email: string;
  name: string | null;
  jobTitle: string | null;
  customRoleId: string | null;
  customRoleName: string | null;
  customRoleColor: string | null;
};
type Invite = { id: string; email: string | null; role: MembershipRole; expires_at: string };

const MEMBER_ROLES: MembershipRole[] = ["owner", "admin", "member", "viewer"];
const INVITE_ROLES: MembershipRole[] = ["admin", "member", "viewer"];

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
  const [editingJobTitle, setEditingJobTitle] = useState<string | null>(null);
  const [jobTitleDraft, setJobTitleDraft] = useState("");
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
                    {editingJobTitle === m.membershipId ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={jobTitleDraft}
                          onChange={(e) => setJobTitleDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              run(() => setJobTitleAction(slug, m.membershipId, jobTitleDraft));
                              setEditingJobTitle(null);
                            }
                            if (e.key === "Escape") setEditingJobTitle(null);
                          }}
                          placeholder="e.g. Developer"
                          className="w-32 rounded border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-indigo-400"
                        />
                        <button
                          onClick={() => { run(() => setJobTitleAction(slug, m.membershipId, jobTitleDraft)); setEditingJobTitle(null); }}
                          className="text-xs text-indigo-600 hover:underline"
                        >Save</button>
                        <button onClick={() => setEditingJobTitle(null)} className="text-xs text-neutral-400 hover:underline">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingJobTitle(m.membershipId); setJobTitleDraft(m.jobTitle ?? ""); }}
                        disabled={readOnly}
                        className="text-xs text-neutral-500 hover:text-neutral-900 disabled:pointer-events-none"
                      >
                        {m.jobTitle || <span className="text-neutral-300 italic">Add title…</span>}
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
