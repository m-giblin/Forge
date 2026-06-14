import type { SupabaseClient } from "@supabase/supabase-js";

export type FieldName = "status" | "priority" | "type";

export type FieldOption = {
  id: string;
  field: FieldName;
  key: string;
  label: string;
  color: string | null;
  position: number;
  is_default: boolean;
  is_terminal: boolean;
};

export type Category = {
  id: string;
  parent_id: string | null;
  name: string;
  position: number;
};

export type CustomFieldType = "text" | "number" | "select" | "date";
export type CustomField = {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
  position: number;
};

const OPT_COLS = "id, field, key, label, color, position, is_default, is_terminal";

/** Per-tenant field-option + category config. Tenant-scoped; RLS guards writes (owner/admin). */
export function fieldConfigRepo(supabase: SupabaseClient) {
  return {
    async listDefaults(tenantId: string): Promise<{ field: string; key: string }[]> {
      const { data, error } = await supabase
        .from("tenant_field_options")
        .select("field, key")
        .eq("tenant_id", tenantId)
        .eq("is_default", true);
      if (error) throw error;
      return (data ?? []) as { field: string; key: string }[];
    },

    async listOptions(tenantId: string): Promise<FieldOption[]> {
      const { data, error } = await supabase
        .from("tenant_field_options")
        .select(OPT_COLS)
        .eq("tenant_id", tenantId)
        .order("field")
        .order("position");
      if (error) throw error;
      return (data ?? []) as FieldOption[];
    },

    async addOption(input: {
      tenant_id: string; field: FieldName; key: string; label: string; color: string | null; position: number;
    }): Promise<FieldOption> {
      const { data, error } = await supabase
        .from("tenant_field_options")
        .insert({ ...input })
        .select(OPT_COLS)
        .single();
      if (error) throw error;
      return data as FieldOption;
    },

    async deleteOption(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase.from("tenant_field_options").delete().eq("tenant_id", tenantId).eq("id", id);
      if (error) throw error;
    },

    async clearDefault(tenantId: string, field: FieldName): Promise<void> {
      const { error } = await supabase
        .from("tenant_field_options")
        .update({ is_default: false })
        .eq("tenant_id", tenantId)
        .eq("field", field);
      if (error) throw error;
    },

    async setDefault(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase
        .from("tenant_field_options")
        .update({ is_default: true })
        .eq("tenant_id", tenantId)
        .eq("id", id);
      if (error) throw error;
    },

    async listCategories(tenantId: string): Promise<Category[]> {
      const { data, error } = await supabase
        .from("tenant_categories")
        .select("id, parent_id, name, position")
        .eq("tenant_id", tenantId)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Category[];
    },

    async addCategory(input: { tenant_id: string; parent_id: string | null; name: string }): Promise<Category> {
      const { data, error } = await supabase
        .from("tenant_categories")
        .insert({ ...input })
        .select("id, parent_id, name, position")
        .single();
      if (error) throw error;
      return data as Category;
    },

    async deleteCategory(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase.from("tenant_categories").delete().eq("tenant_id", tenantId).eq("id", id);
      if (error) throw error;
    },

    async listCustomFields(tenantId: string): Promise<CustomField[]> {
      const { data, error } = await supabase
        .from("tenant_custom_fields")
        .select("id, key, label, type, options, required, position")
        .eq("tenant_id", tenantId)
        .order("position");
      if (error) throw error;
      return (data ?? []) as CustomField[];
    },

    async addCustomField(input: {
      tenant_id: string; key: string; label: string; type: CustomFieldType; options: string[]; required: boolean; position: number;
    }): Promise<CustomField> {
      const { data, error } = await supabase
        .from("tenant_custom_fields")
        .insert(input)
        .select("id, key, label, type, options, required, position")
        .single();
      if (error) throw error;
      return data as CustomField;
    },

    async deleteCustomField(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase.from("tenant_custom_fields").delete().eq("tenant_id", tenantId).eq("id", id);
      if (error) throw error;
    },
  };
}
