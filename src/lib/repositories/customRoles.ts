import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomRole, RbacPermissionSet } from "@/lib/rbac";

const COLS = "id, tenant_id, name, description, color, permissions, is_system, created_at";

export function customRolesRepo(supabase: SupabaseClient) {
  return {
    async list(tenantId: string): Promise<(CustomRole & { memberCount: number })[]> {
      const [rolesRes, countsRes] = await Promise.all([
        supabase
          .from("custom_roles")
          .select(COLS)
          .eq("tenant_id", tenantId)
          .order("name"),
        supabase
          .from("memberships")
          .select("custom_role_id")
          .eq("tenant_id", tenantId)
          .not("custom_role_id", "is", null),
      ]);
      if (rolesRes.error) throw rolesRes.error;
      const countMap = new Map<string, number>();
      for (const m of countsRes.data ?? []) {
        const id = m.custom_role_id as string;
        countMap.set(id, (countMap.get(id) ?? 0) + 1);
      }
      return (rolesRes.data ?? []).map((r) => ({
        ...(r as unknown as CustomRole),
        permissions: (r.permissions ?? {}) as RbacPermissionSet,
        memberCount: countMap.get(r.id) ?? 0,
      }));
    },

    async get(id: string, tenantId: string): Promise<CustomRole | null> {
      const { data, error } = await supabase
        .from("custom_roles")
        .select(COLS)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { ...(data as unknown as CustomRole), permissions: (data.permissions ?? {}) as RbacPermissionSet };
    },

    async create(
      tenantId: string,
      input: { name: string; description?: string; color?: string; permissions: RbacPermissionSet }
    ): Promise<CustomRole> {
      const { data, error } = await supabase
        .from("custom_roles")
        .insert({
          tenant_id: tenantId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          color: input.color ?? "indigo",
          permissions: input.permissions,
        })
        .select(COLS)
        .single();
      if (error) throw error;
      return { ...(data as unknown as CustomRole), permissions: (data.permissions ?? {}) as RbacPermissionSet };
    },

    async update(
      id: string,
      tenantId: string,
      patch: { name?: string; description?: string | null; color?: string; permissions?: RbacPermissionSet }
    ): Promise<CustomRole> {
      const payload: Record<string, unknown> = {};
      if (patch.name !== undefined) payload.name = patch.name.trim();
      if (patch.description !== undefined) payload.description = patch.description?.trim() || null;
      if (patch.color !== undefined) payload.color = patch.color;
      if (patch.permissions !== undefined) payload.permissions = patch.permissions;
      const { data, error } = await supabase
        .from("custom_roles")
        .update(payload)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select(COLS)
        .single();
      if (error) throw error;
      return { ...(data as unknown as CustomRole), permissions: (data.permissions ?? {}) as RbacPermissionSet };
    },

    async delete(id: string, tenantId: string): Promise<void> {
      const { error } = await supabase
        .from("custom_roles")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },

    async assignToMembership(
      membershipId: string,
      tenantId: string,
      customRoleId: string | null
    ): Promise<void> {
      const { error } = await supabase
        .from("memberships")
        .update({ custom_role_id: customRoleId })
        .eq("id", membershipId)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
  };
}
