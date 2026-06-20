import type { SupabaseClient } from "@supabase/supabase-js";

export type TriggerType =
  | "issue.created"
  | "issue.status_changed"
  | "issue.assigned"
  | "comment.created";

export type ConditionOperator = "is" | "is_not" | "contains" | "is_empty";

export type Condition = {
  field: "priority" | "type" | "status" | "assignee_id" | "labels";
  operator: ConditionOperator;
  value?: string;
};

export type ActionType =
  | "set_priority"
  | "set_assignee"
  | "add_label"
  | "post_comment"
  | "fire_webhook";

export type Action = {
  type: ActionType;
  value: string; // priority key | userId | label | comment body | webhook URL
};

export type AutomationRule = {
  id: string;
  tenantId: string;
  name: string;
  enabled: boolean;
  trigger: TriggerType;
  conditions: Condition[];
  actions: Action[];
  createdAt: string;
};

function mapRow(r: Record<string, unknown>): AutomationRule {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    name: r.name as string,
    enabled: r.enabled as boolean,
    trigger: r.trigger as TriggerType,
    conditions: (r.conditions as Condition[]) ?? [],
    actions: (r.actions as Action[]) ?? [],
    createdAt: r.created_at as string,
  };
}

export function automationRulesRepo(supabase: SupabaseClient) {
  return {
    async list(tenantId: string): Promise<AutomationRule[]> {
      const { data, error } = await supabase
        .from("automation_rules")
        .select("id, tenant_id, name, enabled, trigger, conditions, actions, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
    },

    async listEnabledForTrigger(tenantId: string, trigger: TriggerType): Promise<AutomationRule[]> {
      const { data, error } = await supabase
        .from("automation_rules")
        .select("id, tenant_id, name, enabled, trigger, conditions, actions, created_at")
        .eq("tenant_id", tenantId)
        .eq("enabled", true)
        .eq("trigger", trigger);
      if (error) throw error;
      return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
    },

    async create(tenantId: string, input: Omit<AutomationRule, "id" | "tenantId" | "createdAt">): Promise<AutomationRule> {
      const { data, error } = await supabase
        .from("automation_rules")
        .insert({
          tenant_id: tenantId,
          name: input.name,
          enabled: input.enabled,
          trigger: input.trigger,
          conditions: input.conditions,
          actions: input.actions,
        })
        .select("id, tenant_id, name, enabled, trigger, conditions, actions, created_at")
        .single();
      if (error) throw error;
      return mapRow(data as Record<string, unknown>);
    },

    async update(tenantId: string, id: string, patch: Partial<Pick<AutomationRule, "name" | "enabled" | "trigger" | "conditions" | "actions">>): Promise<void> {
      const { error } = await supabase
        .from("automation_rules")
        .update(patch)
        .eq("tenant_id", tenantId)
        .eq("id", id);
      if (error) throw error;
    },

    async delete(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase
        .from("automation_rules")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", id);
      if (error) throw error;
    },
  };
}
