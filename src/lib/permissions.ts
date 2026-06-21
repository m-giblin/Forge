/**
 * Lightweight per-tenant permission overrides.
 *
 * Forge has four fixed roles (owner / admin / member / viewer). Owners and
 * admins always have full access. This module controls what members and viewers
 * can do — defaults are conservative and tenants can loosen them via the
 * Settings → Permissions admin page.
 *
 * Overrides are stored as a flat JSON object on tenants.permission_overrides.
 * A missing key means "use the default".
 */

export type PermissionKey =
  | "viewer.create_issue"    // can viewers file new issues?
  | "viewer.comment"         // can viewers post comments?
  | "viewer.close_issue"     // can viewers change status to done/closed?
  | "member.delete_issue"    // can members hard-delete issues?
  | "member.manage_projects" // can members create / rename / archive projects?
  | "member.invite_members"  // can members send invitations?
  | "member.manage_fields";  // can members configure custom fields / labels?

// Conservative defaults: viewers are read-only + comment; members cannot delete or admin
const DEFAULTS: Record<PermissionKey, boolean> = {
  "viewer.create_issue": false,
  "viewer.comment": true,
  "viewer.close_issue": false,
  "member.delete_issue": false,
  "member.manage_projects": false,
  "member.invite_members": false,
  "member.manage_fields": false,
};

export type PermissionOverrides = Partial<Record<PermissionKey, boolean>>;

/**
 * Check whether a role is allowed to perform an action, applying tenant overrides.
 * Owners and admins always return true (no override can strip their access).
 */
export function canDo(
  role: "owner" | "admin" | "member" | "viewer",
  key: PermissionKey,
  overrides: PermissionOverrides = {}
): boolean {
  if (role === "owner" || role === "admin") return true;
  // Only member.* keys apply to member; only viewer.* keys apply to viewer
  const rolePrefix = key.split(".")[0];
  if (role !== rolePrefix) {
    // viewer trying to do a member action → always false (no override can grant upward)
    if (role === "viewer" && rolePrefix === "member") return false;
  }
  return overrides[key] ?? DEFAULTS[key];
}

export { DEFAULTS as PERMISSION_DEFAULTS };

/** Human-readable label + description for each key, used in the admin UI. */
export const PERMISSION_META: Record<PermissionKey, { label: string; description: string }> = {
  "viewer.create_issue": {
    label: "Create issues",
    description: "Viewers can file new bug reports or feature requests.",
  },
  "viewer.comment": {
    label: "Post comments",
    description: "Viewers can add comments to existing issues.",
  },
  "viewer.close_issue": {
    label: "Close / reopen issues",
    description: "Viewers can change issue status to done or reopen it.",
  },
  "member.delete_issue": {
    label: "Delete issues",
    description: "Members can permanently delete issues (not just close them).",
  },
  "member.manage_projects": {
    label: "Manage projects",
    description: "Members can create, rename, or archive projects.",
  },
  "member.invite_members": {
    label: "Invite team members",
    description: "Members can send invitations to join the workspace.",
  },
  "member.manage_fields": {
    label: "Manage custom fields & labels",
    description: "Members can add, edit, or remove custom fields and label options.",
  },
};
