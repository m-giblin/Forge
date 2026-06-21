/**
 * Role-Based Access Control (RBAC) — enterprise tier.
 *
 * The four system roles (owner/admin/member/viewer) remain the backbone.
 * Custom roles sit at or below member level: they define a named permission
 * set stored on the custom_roles table. When a membership has a custom_role_id,
 * rbacCanDo() uses that role's permissions instead of the member/viewer defaults.
 *
 * Owners and Admins always return true — no custom role can restrict them.
 * Gated by the `rbac` feature flag (per-tenant, off by default).
 */

export const RBAC_PERMISSIONS = [
  "create_issues",
  "edit_any_issue",
  "delete_issues",
  "manage_sprints",
  "manage_projects",
  "manage_roadmap",
  "view_roadmap",
  "manage_members",
  "manage_settings",
  "manage_api_keys",
  "view_reports",
  "export_data",
] as const;

export type RbacPermission = (typeof RBAC_PERMISSIONS)[number];
export type RbacPermissionSet = Partial<Record<RbacPermission, boolean>>;

export type CustomRole = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  color: string;
  permissions: RbacPermissionSet;
  is_system: boolean;
  created_at: string;
  memberCount?: number;
};

export const ROLE_COLORS = [
  "indigo",
  "violet",
  "blue",
  "cyan",
  "emerald",
  "amber",
  "rose",
  "slate",
] as const;
export type RoleColor = (typeof ROLE_COLORS)[number];

export const COLOR_CLASSES: Record<RoleColor, { bg: string; text: string; border: string }> = {
  indigo:  { bg: "bg-indigo-100",  text: "text-indigo-700",  border: "border-indigo-300" },
  violet:  { bg: "bg-violet-100",  text: "text-violet-700",  border: "border-violet-300" },
  blue:    { bg: "bg-blue-100",    text: "text-blue-700",    border: "border-blue-300" },
  cyan:    { bg: "bg-cyan-100",    text: "text-cyan-700",    border: "border-cyan-300" },
  emerald: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300" },
  amber:   { bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-300" },
  rose:    { bg: "bg-rose-100",    text: "text-rose-700",    border: "border-rose-300" },
  slate:   { bg: "bg-slate-100",   text: "text-slate-700",   border: "border-slate-300" },
};

export type PermissionGroup = "Issues" | "Planning" | "Admin" | "Reporting";

export const PERMISSION_META: Record<
  RbacPermission,
  { label: string; description: string; group: PermissionGroup }
> = {
  create_issues:   { label: "Create issues",       description: "Can file new bugs, tasks, or feature requests",  group: "Issues"    },
  edit_any_issue:  { label: "Edit any issue",       description: "Can edit issues not assigned to them",           group: "Issues"    },
  delete_issues:   { label: "Delete issues",        description: "Can permanently delete issues",                  group: "Issues"    },
  manage_sprints:  { label: "Manage sprints",       description: "Can create, start, and complete sprints",        group: "Planning"  },
  manage_projects: { label: "Manage projects",      description: "Can create and archive projects",                group: "Planning"  },
  manage_roadmap:  { label: "Edit roadmap",         description: "Can add and edit roadmap items",                 group: "Planning"  },
  view_roadmap:    { label: "View roadmap",         description: "Can access the Roadmap tab",                     group: "Planning"  },
  manage_members:  { label: "Manage members",       description: "Can invite and remove workspace members",        group: "Admin"     },
  manage_settings: { label: "Manage settings",      description: "Can change workspace settings",                  group: "Admin"     },
  manage_api_keys: { label: "Manage API keys",      description: "Can create and revoke API keys",                 group: "Admin"     },
  view_reports:    { label: "View reports",         description: "Can access the Reports tab",                     group: "Reporting" },
  export_data:     { label: "Export data",          description: "Can export issues and reports as CSV",           group: "Reporting" },
};

export const PERMISSION_GROUPS: PermissionGroup[] = ["Issues", "Planning", "Admin", "Reporting"];

/** Default permissions for a member with no custom role assigned. */
const MEMBER_DEFAULTS: Record<RbacPermission, boolean> = {
  create_issues:   true,
  edit_any_issue:  false,
  delete_issues:   false,
  manage_sprints:  false,
  manage_projects: false,
  manage_roadmap:  false,
  view_roadmap:    true,
  manage_members:  false,
  manage_settings: false,
  manage_api_keys: false,
  view_reports:    true,
  export_data:     false,
};

/** Default permissions for a viewer with no custom role assigned. */
const VIEWER_DEFAULTS: Record<RbacPermission, boolean> = {
  create_issues:   false,
  edit_any_issue:  false,
  delete_issues:   false,
  manage_sprints:  false,
  manage_projects: false,
  manage_roadmap:  false,
  view_roadmap:    true,
  manage_members:  false,
  manage_settings: false,
  manage_api_keys: false,
  view_reports:    true,
  export_data:     false,
};

/**
 * Check whether a user can perform an action.
 * - Owner and Admin always return true.
 * - If a custom role is provided, its permission set wins over system defaults.
 * - Falls back to member/viewer defaults when no custom role is assigned.
 */
export function rbacCanDo(
  permission: RbacPermission,
  baseRole: "owner" | "admin" | "member" | "viewer",
  customRolePermissions?: RbacPermissionSet | null
): boolean {
  if (baseRole === "owner" || baseRole === "admin") return true;
  if (customRolePermissions != null) {
    return customRolePermissions[permission] ?? false;
  }
  const defaults = baseRole === "member" ? MEMBER_DEFAULTS : VIEWER_DEFAULTS;
  return defaults[permission];
}
