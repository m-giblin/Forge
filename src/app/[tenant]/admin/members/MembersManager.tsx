"use client";

import { useState, useTransition } from "react";
import {
  createInviteAction,
  revokeInviteAction,
  changeRoleAction,
  removeMemberAction,
  setJobTitlesAction,
  setMemberNameAction,
  assignCustomRoleAction,
  sendPasswordResetAction,
} from "./actions";
import type { MembershipRole } from "@/lib/repositories/members";
import { COLOR_CLASSES, type RoleColor } from "@/lib/rbac";
import AdminTable, { type AdminTableCell } from "@/components/patterns/admin/AdminTable";
import FormGrid from "@/components/patterns/admin/FormGrid";
import AdminList from "@/components/patterns/admin/AdminList";
import Modal from "@/components/Modal";

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
  "Developer":       "bg-[#eaf1f8] text-[#3a6ea8] border-[#cfe0ee]",
  "Designer":        "bg-[#f4ecfa] text-[#7a4fa0] border-[#e4d4f0]",
  "QA Engineer":     "bg-[#fbeae8] text-[#c0392b] border-[#f0cfc9]",
  "Product Manager": "bg-[#fdf1de] text-[#c9791d] border-[#f3ddb4]",
  "Team Lead":       "bg-[#e9f3ea] text-[#3f7d4c] border-[#cfe6d2]",
  "Scrum Master":    "bg-[#f5e3dd] text-[#8c4632] border-[#e8c9bd]",
  "Stakeholder":     "bg-[#fdf1de] text-[#c9791d] border-[#f3ddb4]",
  "Consultant":      "bg-[#eaf1f8] text-[#3a6ea8] border-[#cfe0ee]",
  "DevOps":          "bg-[#f4ecfa] text-[#7a4fa0] border-[#e4d4f0]",
  "Data Analyst":    "bg-[#f5e3dd] text-[#8c4632] border-[#e8c9bd]",
};
const DEFAULT_TITLE_COLOR = "bg-[#f1efe9] text-[#726e60] border-[#ddd8c9]";

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

// Role chip colors — rust for admin/owner, existing "blue" token for member, faint for viewer.
// (matches the not-amber convention: rust accents are reserved, blue/faint come from lib/rbac's COLOR_CLASSES palette)
const ROLE_CHIP: Record<string, { fg: string; bg: string }> = {
  owner: { fg: "#b7452f", bg: "#f5e3dd" },
  admin: { fg: "#b7452f", bg: "#f5e3dd" },
  member: { fg: "#3a6ea8", bg: "#eaf1f8" },
  viewer: { fg: "#726e60", bg: "#f1efe9" },
};

const fieldClass =
  "w-full rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[12.5px] text-[#20201d] outline-none focus:border-[#b7452f]";

// ── Inline job-title picker (used in the edit panel) ────────────────────────
function JobTitlePicker({ selected, onToggle }: { selected: string[]; onToggle: (t: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {JOB_TITLE_OPTIONS.map((t) => {
        const active = selected.includes(t);
        const color = active ? (TITLE_COLORS[t] ?? DEFAULT_TITLE_COLOR) : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-400";
        return (
          <button key={t} type="button" onClick={() => onToggle(t)}
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${color}`}>
            {t}
          </button>
        );
      })}
    </div>
  );
}

// ── Edit modal for a single member — profile, role, job titles, custom role, remove ──
function MemberEditModal({
  slug,
  member,
  readOnly,
  showJobTitles,
  showRbac,
  customRoles,
  isSelf,
  onClose,
  onRun,
}: {
  slug: string;
  member: Member;
  readOnly: boolean;
  showJobTitles: boolean;
  showRbac: boolean;
  customRoles: CustomRoleOption[];
  isSelf: boolean;
  onClose: () => void;
  onRun: (fn: () => Promise<unknown>) => void;
}) {
  const [name, setName] = useState(member.name ?? "");
  const [role, setRole] = useState<MembershipRole>(member.role);
  const [titles, setTitles] = useState<string[]>(member.jobTitles);
  const [customRoleId, setCustomRoleId] = useState<string>(member.customRoleId ?? "");
  const [resetStatus, setResetStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resetError, setResetError] = useState<string | null>(null);

  function sendReset() {
    setResetStatus("sending");
    setResetError(null);
    onRun(async () => {
      try {
        await sendPasswordResetAction(slug, member.membershipId, member.userId);
        setResetStatus("sent");
      } catch (e) {
        setResetStatus("error");
        setResetError(e instanceof Error ? e.message : "Failed to send reset link");
      }
    });
  }

  function toggleTitle(t: string) {
    setTitles((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const fields = [
    {
      key: "name",
      label: "Name",
      input: (
        <input
          value={name}
          disabled={readOnly}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className={fieldClass}
        />
      ),
    },
    {
      key: "email",
      label: "Email",
      input: (
        <input
          value={member.email}
          disabled
          title="Sign-in email can't be changed here — it's the account's login identity."
          className={`${fieldClass} cursor-not-allowed bg-[#f4f2eb] text-[#a19d90]`}
        />
      ),
    },
    {
      key: "role",
      label: "Role",
      input: (
        <select
          value={role}
          disabled={readOnly}
          onChange={(e) => setRole(e.target.value as MembershipRole)}
          className={`${fieldClass} capitalize`}
        >
          {MEMBER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      ),
    },
  ];

  if (showRbac) {
    fields.push({
      key: "customRole",
      label: "Custom role",
      input: (
        <select
          value={customRoleId}
          disabled={readOnly}
          onChange={(e) => setCustomRoleId(e.target.value)}
          className={fieldClass}
        >
          <option value="">— None (system defaults) —</option>
          {customRoles.map((cr) => <option key={cr.id} value={cr.id}>{cr.name}</option>)}
        </select>
      ),
    });
  }

  if (showJobTitles) {
    fields.push({
      key: "jobTitles",
      label: "Job titles",
      input: <JobTitlePicker selected={titles} onToggle={toggleTitle} />,
    });
  }

  return (
    <Modal open onClose={onClose} label={`Edit ${member.name || member.email}`} className="fw-card w-full max-w-md p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[15px] font-extrabold text-[#20201d]" style={{ fontFamily: "var(--font-manrope)" }}>
          {member.name || member.email}
        </p>
        <button type="button" onClick={onClose} aria-label="Close" className="text-[#a19d90] hover:text-[#726e60]">✕</button>
      </div>
      <FormGrid
        fields={fields}
        onCancel={onClose}
        onSubmit={readOnly ? undefined : () => {
          if (name.trim() && name.trim() !== (member.name ?? "")) onRun(() => setMemberNameAction(slug, member.membershipId, member.userId, name.trim()));
          if (role !== member.role) onRun(() => changeRoleAction(slug, member.membershipId, role));
          if (showRbac && customRoleId !== (member.customRoleId ?? "")) onRun(() => assignCustomRoleAction(slug, member.membershipId, customRoleId || null));
          if (showJobTitles && titles.join(",") !== member.jobTitles.join(",")) onRun(() => setJobTitlesAction(slug, member.membershipId, titles));
          onClose();
        }}
        submitLabel="Save"
      />
      {!readOnly && (
        <div className="mt-3 border-t border-[#ddd8c9] pt-3">
          {resetStatus === "sent" ? (
            <p className="text-[11.5px] font-semibold text-[#3f7d4c]">✓ Reset link sent to {member.email}</p>
          ) : resetStatus === "error" ? (
            <p className="text-[11.5px] text-[#c0392b]">{resetError}</p>
          ) : (
            <button
              type="button"
              onClick={sendReset}
              disabled={resetStatus === "sending"}
              className="text-[11.5px] font-semibold text-[#b7452f] hover:underline disabled:opacity-50"
            >
              {resetStatus === "sending" ? "Sending…" : "Send password reset link"}
            </button>
          )}
        </div>
      )}
      {!isSelf && !readOnly && (
        <div className="mt-3 border-t border-[#ddd8c9] pt-3 text-right">
          <button
            type="button"
            onClick={() => { if (confirm("Remove this member from the workspace?")) { onRun(() => removeMemberAction(slug, member.membershipId)); onClose(); } }}
            className="text-[11.5px] font-semibold text-[#c0392b] hover:underline"
          >
            Remove from workspace
          </button>
        </div>
      )}
    </Modal>
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
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MembershipRole>("member");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try { await fn(); }
      catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    });
  }

  function submitInvite() {
    setError(null);
    setInviteLink(null);
    startTransition(async () => {
      try {
        const { token } = await createInviteAction(slug, {
          email: inviteEmail.trim() || null,
          role: inviteRole,
          displayName: inviteName.trim() || null,
          jobTitles: [],
        });
        setInviteLink(`${window.location.origin}/join/${token}`);
        setInviteName("");
        setInviteEmail("");
        setInviteRole("member");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create invite");
      }
    });
  }

  const columns = [
    { label: "Member", flex: true },
    ...(showJobTitles ? [{ label: "Job title", width: 170 }] : []),
    ...(showRbac ? [{ label: "Custom role", width: 150 }] : []),
    { label: "Role", width: 110 },
    { label: "", width: 90 },
  ];

  const editingMember = members.find((m) => m.membershipId === editingId);

  const rows: AdminTableCell[][] = members.map((m) => {
    const chip = ROLE_CHIP[m.role] ?? ROLE_CHIP.viewer;
    const row: AdminTableCell[] = [
      { kind: "text", value: m.name || m.email },
      ...(showJobTitles ? [{ kind: "dim", value: m.jobTitles.length > 0 ? m.jobTitles.join(", ") : "—" } as AdminTableCell] : []),
      ...(showRbac ? [{ kind: "dim", value: m.customRoleName ?? "—" } as AdminTableCell] : []),
      { kind: "chip", value: m.role.charAt(0).toUpperCase() + m.role.slice(1), chipFg: chip.fg, chipBg: chip.bg },
      { kind: "link", value: "Edit", onClick: () => setEditingId(m.membershipId) },
    ];
    return row;
  });

  return (
    <div className="space-y-6">
      {error && <p className="rounded-[5px] border border-[#f0cfc9] bg-[#fbeae8] px-3 py-2 text-[12px] font-semibold text-[#c0392b]">{error}</p>}

      {editingMember && (
        <MemberEditModal
          slug={slug}
          member={editingMember}
          readOnly={readOnly}
          showJobTitles={showJobTitles}
          showRbac={showRbac}
          customRoles={customRoles}
          isSelf={editingMember.userId === currentUserId}
          onClose={() => setEditingId(null)}
          onRun={run}
        />
      )}

      <AdminTable columns={columns} rows={rows} />

      {invites.length > 0 && (
        <div>
          <p className="mb-2 px-0.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">
            Pending invites
          </p>
          <AdminList
            items={invites.map((inv) => ({
              key: inv.id,
              title: inv.email ?? "any email",
              subline: `${inv.role.charAt(0).toUpperCase() + inv.role.slice(1)} · expires ${new Date(inv.expires_at).toLocaleDateString()}`,
              actionLabel: readOnly ? undefined : "Revoke",
              onAction: readOnly ? undefined : () => run(() => revokeInviteAction(slug, inv.id)),
            }))}
          />
        </div>
      )}

      {!readOnly && (
        <div>
          <FormGrid
            fields={[
              {
                key: "name",
                label: "Name",
                input: <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Alex Chen" className={fieldClass} />,
              },
              {
                key: "email",
                label: "Email",
                input: <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="alex@company.com" className={fieldClass} />,
              },
              {
                key: "role",
                label: "Role",
                input: (
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as MembershipRole)} className={`${fieldClass} capitalize`}>
                    {INVITE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                ),
              },
            ]}
            onSubmit={submitInvite}
            submitLabel="Send invite"
          />
          {inviteLink && (
            <div className="fw-card mt-2 flex items-center gap-2 px-3.5 py-2.5">
              <code className="flex-1 overflow-x-auto text-[11.5px] text-[#726e60] select-all">{inviteLink}</code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(inviteLink)}
                className="shrink-0 text-[11.5px] font-semibold text-[#b7452f] hover:underline"
              >
                Copy link
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
