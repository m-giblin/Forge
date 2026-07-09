import type { SupabaseClient } from "@supabase/supabase-js";

export type PermissionDefinition = {
  key: string;
  label: string;
  description: string;
  groupName: string;
  memberDefault: boolean;
  viewerDefault: boolean;
  isActive: boolean;
};

export function permissionDefinitionsRepo(supabase: SupabaseClient) {
  return {
    /** Every active permission — the source of truth for the custom-role editor and enforcement defaults. */
    async listActive(): Promise<PermissionDefinition[]> {
      const { data } = await supabase
        .from("permission_definitions")
        .select("key, label, description, group_name, member_default, viewer_default, is_active")
        .eq("is_active", true)
        .order("group_name")
        .order("key");
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        key: r.key as string,
        label: r.label as string,
        description: r.description as string,
        groupName: r.group_name as string,
        memberDefault: r.member_default as boolean,
        viewerDefault: r.viewer_default as boolean,
        isActive: r.is_active as boolean,
      }));
    },

    /** Includes inactive ones too — for the platform admin catalog page. */
    async listAll(): Promise<PermissionDefinition[]> {
      const { data } = await supabase
        .from("permission_definitions")
        .select("key, label, description, group_name, member_default, viewer_default, is_active")
        .order("group_name")
        .order("key");
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        key: r.key as string,
        label: r.label as string,
        description: r.description as string,
        groupName: r.group_name as string,
        memberDefault: r.member_default as boolean,
        viewerDefault: r.viewer_default as boolean,
        isActive: r.is_active as boolean,
      }));
    },

    async create(input: Omit<PermissionDefinition, "isActive">): Promise<void> {
      const { error } = await supabase.from("permission_definitions").insert({
        key: input.key,
        label: input.label,
        description: input.description,
        group_name: input.groupName,
        member_default: input.memberDefault,
        viewer_default: input.viewerDefault,
      });
      if (error) throw error;
    },

    async update(key: string, patch: Partial<Omit<PermissionDefinition, "key">>): Promise<void> {
      const dbPatch: Record<string, unknown> = {};
      if (patch.label !== undefined) dbPatch.label = patch.label;
      if (patch.description !== undefined) dbPatch.description = patch.description;
      if (patch.groupName !== undefined) dbPatch.group_name = patch.groupName;
      if (patch.memberDefault !== undefined) dbPatch.member_default = patch.memberDefault;
      if (patch.viewerDefault !== undefined) dbPatch.viewer_default = patch.viewerDefault;
      if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;
      const { error } = await supabase.from("permission_definitions").update(dbPatch).eq("key", key);
      if (error) throw error;
    },
  };
}
