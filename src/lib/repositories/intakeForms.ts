import type { SupabaseClient } from "@supabase/supabase-js";

export type IntakeForm = {
  id: string;
  tenant_id: string;
  project_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  token_hash: string;
  created_at: string;
};

export type IntakeFormField = {
  id: string;
  form_id: string;
  label: string;
  type: "text" | "textarea" | "select";
  options: string[];
  required: boolean;
  position: number;
};

export type IntakeSubmission = {
  id: string;
  tenant_id: string;
  form_id: string;
  summary: string;
  answers: Record<string, string>;
  submitter_email: string | null;
  status: "new" | "converted" | "dismissed";
  converted_issue_id: string | null;
  created_at: string;
};

const FORM_COLS = "id, tenant_id, project_id, name, description, is_active, token_hash, created_at";
const FIELD_COLS = "id, form_id, label, type, options, required, position";
const SUBMISSION_COLS = "id, tenant_id, form_id, summary, answers, submitter_email, status, converted_issue_id, created_at";

export function intakeFormsRepo(supabase: SupabaseClient) {
  return {
    async listForTenant(tenantId: string): Promise<IntakeForm[]> {
      const { data, error } = await supabase.from("intake_forms").select(FORM_COLS).eq("tenant_id", tenantId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as IntakeForm[];
    },

    async get(tenantId: string, id: string): Promise<IntakeForm | null> {
      const { data, error } = await supabase.from("intake_forms").select(FORM_COLS).eq("tenant_id", tenantId).eq("id", id).maybeSingle();
      if (error) throw error;
      return data as IntakeForm | null;
    },

    async resolveByTokenHash(tokenHash: string): Promise<IntakeForm | null> {
      const { data, error } = await supabase.from("intake_forms").select(FORM_COLS).eq("token_hash", tokenHash).eq("is_active", true).maybeSingle();
      if (error) throw error;
      return data as IntakeForm | null;
    },

    async create(input: { tenant_id: string; project_id: string; name: string; description: string | null; token_hash: string; created_by: string }): Promise<IntakeForm> {
      const { data, error } = await supabase.from("intake_forms").insert(input).select(FORM_COLS).single();
      if (error) throw error;
      return data as IntakeForm;
    },

    async setActive(tenantId: string, id: string, isActive: boolean): Promise<void> {
      const { error } = await supabase.from("intake_forms").update({ is_active: isActive }).eq("tenant_id", tenantId).eq("id", id);
      if (error) throw error;
    },

    async regenerateToken(tenantId: string, id: string, tokenHash: string): Promise<void> {
      const { error } = await supabase.from("intake_forms").update({ token_hash: tokenHash, is_active: true }).eq("tenant_id", tenantId).eq("id", id);
      if (error) throw error;
    },

    async remove(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase.from("intake_forms").delete().eq("tenant_id", tenantId).eq("id", id);
      if (error) throw error;
    },
  };
}

export function intakeFormFieldsRepo(supabase: SupabaseClient) {
  return {
    async listForForm(formId: string): Promise<IntakeFormField[]> {
      const { data, error } = await supabase.from("intake_form_fields").select(FIELD_COLS).eq("form_id", formId).order("position");
      if (error) throw error;
      return (data ?? []) as IntakeFormField[];
    },

    async add(input: { tenant_id: string; form_id: string; label: string; type: "text" | "textarea" | "select"; options: string[]; required: boolean; position: number }): Promise<IntakeFormField> {
      const { data, error } = await supabase.from("intake_form_fields").insert(input).select(FIELD_COLS).single();
      if (error) throw error;
      return data as IntakeFormField;
    },

    async remove(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase.from("intake_form_fields").delete().eq("tenant_id", tenantId).eq("id", id);
      if (error) throw error;
    },
  };
}

export function intakeSubmissionsRepo(supabase: SupabaseClient) {
  return {
    async listForForm(tenantId: string, formId: string): Promise<IntakeSubmission[]> {
      const { data, error } = await supabase.from("intake_submissions").select(SUBMISSION_COLS).eq("tenant_id", tenantId).eq("form_id", formId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as IntakeSubmission[];
    },

    async get(tenantId: string, id: string): Promise<IntakeSubmission | null> {
      const { data, error } = await supabase.from("intake_submissions").select(SUBMISSION_COLS).eq("tenant_id", tenantId).eq("id", id).maybeSingle();
      if (error) throw error;
      return data as IntakeSubmission | null;
    },

    async create(input: { tenant_id: string; form_id: string; summary: string; answers: Record<string, string>; submitter_email: string | null }): Promise<void> {
      const { error } = await supabase.from("intake_submissions").insert(input);
      if (error) throw error;
    },

    async markConverted(tenantId: string, id: string, issueId: string): Promise<void> {
      const { error } = await supabase.from("intake_submissions").update({ status: "converted", converted_issue_id: issueId }).eq("tenant_id", tenantId).eq("id", id);
      if (error) throw error;
    },

    async markDismissed(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase.from("intake_submissions").update({ status: "dismissed" }).eq("tenant_id", tenantId).eq("id", id);
      if (error) throw error;
    },
  };
}
